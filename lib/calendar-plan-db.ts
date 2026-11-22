// Loads a student's plan in both languages and turns it into calendar events.
import { buildCalendar } from "./calendar-ics";
import { buildPlanEvents, calendarName, type CalendarLang } from "./calendar-plan";
import { planViewDeps } from "./plan-db";
import { buildPlannerPageData } from "./plan-view";

/** Returns the calendar text, or null when the student has no plan yet. */
export async function renderPlanCalendar(userId: string, lang: CalendarLang, feed: boolean, now = new Date()): Promise<string | null> {
  const otherLang: CalendarLang = lang === "en" ? "id" : "en";
  const [main, other] = await Promise.all([
    buildPlannerPageData(planViewDeps, userId, now, lang),
    buildPlannerPageData(planViewDeps, userId, now, otherLang),
  ]);
  if (main.state !== "plan" || other.state !== "plan") return null;
  return buildCalendar({
    events: buildPlanEvents(main, other, lang),
    now,
    ...(feed ? { feed: { name: calendarName(lang) } } : {}),
  });
}
