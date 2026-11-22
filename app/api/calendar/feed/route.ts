import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { calendarFeeds } from "@/lib/db/schema";
import { generateFeedToken, hashFeedToken } from "@/lib/calendar-feed-token";
import { isCalendarLang } from "@/lib/calendar-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Option B management: status, create or regenerate, change language, turn off.
// The link is returned once, when it is created; it cannot be read back because
// only its hash is stored.
const noStore = { "Cache-Control": "private, no-store" };

function linksFor(request: Request, token: string) {
  const origin = new URL(request.url).origin;
  const https = `${origin}/api/calendar/feed/${token}.ics`;
  return { url: https, webcalUrl: https.replace(/^https?:/, "webcal:") };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const [feed] = await db
      .select({ lang: calendarFeeds.lang, createdAt: calendarFeeds.createdAt, lastFetchedAt: calendarFeeds.lastFetchedAt })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.userId, user.id))
      .limit(1);
    return NextResponse.json(
      feed
        ? { active: true, lang: feed.lang, createdAt: feed.createdAt.toISOString(), lastFetchedAt: feed.lastFetchedAt?.toISOString() ?? null }
        : { active: false },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body: { lang?: unknown } = await request.json().catch(() => ({}));
  const lang = isCalendarLang(body.lang) ? body.lang : "en";
  const token = generateFeedToken();
  try {
    // Create, or replace the hash: the old link stops working at once.
    await db
      .insert(calendarFeeds)
      .values({ userId: user.id, tokenHash: hashFeedToken(token), lang })
      .onConflictDoUpdate({
        target: calendarFeeds.userId,
        set: { tokenHash: hashFeedToken(token), lang, createdAt: new Date(), lastFetchedAt: null },
      });
    return NextResponse.json({ ...linksFor(request, token), lang }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body: { lang?: unknown } = await request.json().catch(() => ({}));
  if (!isCalendarLang(body.lang)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const updated = await db.update(calendarFeeds).set({ lang: body.lang }).where(eq(calendarFeeds.userId, user.id)).returning({ lang: calendarFeeds.lang });
    if (updated.length === 0) return NextResponse.json({ error: "no_feed" }, { status: 404 });
    return NextResponse.json({ lang: updated[0]!.lang }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await db.delete(calendarFeeds).where(eq(calendarFeeds.userId, user.id));
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
