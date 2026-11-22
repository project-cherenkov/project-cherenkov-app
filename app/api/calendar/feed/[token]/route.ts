import { NextResponse } from "next/server";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeeds } from "@/lib/db/schema";
import { hashFeedToken, isWellFormedFeedToken, tokenFromSegment } from "@/lib/calendar-feed-token";
import { isCalendarLang } from "@/lib/calendar-plan";
import { renderPlanCalendar } from "@/lib/calendar-plan-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A calendar app subscribes here. No session and no cookies: the secret token
// in the path is the credential. An unknown, revoked or malformed token all get
// the same 404. Never log the token. (Hosting access logs may record the path;
// the privacy text says so.)
const FEED_HEADERS = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "private, no-cache, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow",
};
const NOT_FOUND = () => new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" } });
const THROTTLE_SECONDS = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = tokenFromSegment((await params).token);
  if (!isWellFormedFeedToken(token)) return NOT_FOUND();
  try {
    // Light throttling, atomic: the fetch time is claimed only when the last
    // one is old enough, so concurrent requests cannot all pass.
    const claimed = await db
      .update(calendarFeeds)
      .set({ lastFetchedAt: new Date() })
      .where(
        and(
          eq(calendarFeeds.tokenHash, hashFeedToken(token)),
          or(isNull(calendarFeeds.lastFetchedAt), lt(calendarFeeds.lastFetchedAt, sql`now() - make_interval(secs => ${THROTTLE_SECONDS})`)),
        ),
      )
      .returning({ userId: calendarFeeds.userId, lang: calendarFeeds.lang });
    if (claimed.length === 0) {
      const [exists] = await db.select({ userId: calendarFeeds.userId }).from(calendarFeeds).where(eq(calendarFeeds.tokenHash, hashFeedToken(token))).limit(1);
      if (!exists) return NOT_FOUND();
      return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": String(THROTTLE_SECONDS), "Cache-Control": "no-store" } });
    }
    const { userId, lang } = claimed[0]!;
    const calendar = await renderPlanCalendar(userId, isCalendarLang(lang) ? lang : "en", true);
    // No plan yet: an empty (but valid) calendar, so the subscription stays alive.
    const body = calendar ?? "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Project Cherenkov//Study plan//EN\r\nMETHOD:PUBLISH\r\nEND:VCALENDAR\r\n";
    return new NextResponse(body, { headers: FEED_HEADERS });
  } catch {
    return new NextResponse("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
