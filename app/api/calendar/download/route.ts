import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isCalendarLang } from "@/lib/calendar-plan";
import { renderPlanCalendar } from "@/lib/calendar-plan-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Option A: a one-time .ics of the signed-in student's current plan. A
// snapshot: importing it again can duplicate events; the feed stays current.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("lang");
  const lang = isCalendarLang(requested) ? requested : "en";
  try {
    const calendar = await renderPlanCalendar(user.id, lang, false);
    if (calendar === null) return NextResponse.json({ error: "no_plan" }, { status: 404 });
    return new NextResponse(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cherenkov-plan.ics"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
