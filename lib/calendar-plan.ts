// What goes into a student's calendar: one all-day event per upcoming,
// incomplete plan item, plus one exam-day event. Nothing else is exported (no
// minutes, reason, link, score, name or email): the people using the planner
// are often minors, and a feed link can be shared.
import type { CalendarEvent } from "./calendar-ics";
import type { PlannerPageData } from "./plan-view";
import { STAGES } from "./osn-stages";
import enPlanner from "../messages/en/planner.json";
import idPlanner from "../messages/id/planner.json";

export type CalendarLang = "en" | "id";
export const CALENDAR_LANGS: readonly CalendarLang[] = ["en", "id"];
export function isCalendarLang(value: unknown): value is CalendarLang {
  return value === "en" || value === "id";
}

const KIND_LABELS: Record<CalendarLang, Record<string, string>> = {
  en: enPlanner.planner.plan.kind,
  id: idPlanner.planner.plan.kind,
};
const PROVISIONAL: Record<CalendarLang, string> = { en: "provisional", id: "sementara" };
const CALENDAR_NAME: Record<CalendarLang, string> = { en: "Cherenkov study plan", id: "Rencana belajar Cherenkov" };
export const calendarName = (lang: CalendarLang) => CALENDAR_NAME[lang];

type PlanData = Extract<PlannerPageData, { state: "plan" }>;

function safeKey(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/g, "-");
}

/**
 * `main` is the plan loaded in the language the entries should be titled in,
 * `other` the same plan in the other language (it goes in the description).
 * Both must come from the same moment, so their items match one to one.
 */
export function buildPlanEvents(main: PlanData, other: PlanData, lang: CalendarLang): CalendarEvent[] {
  const otherLang: CalendarLang = lang === "en" ? "id" : "en";
  const otherById = new Map(other.items.map((item) => [item.id, item]));
  const events: CalendarEvent[] = [];

  for (const item of main.items) {
    if (item.done || item.scheduledFor < main.today) continue;
    const counterpart = otherById.get(item.id) ?? item;
    const label = (kind: string, l: CalendarLang) => KIND_LABELS[l][kind] ?? kind;
    events.push({
      // Plan item ids do not survive regenerating the plan (open items are
      // deleted and re-inserted), so the UID comes from what the item is.
      uid: `cherenkov-plan-${item.scheduledFor}-${safeKey(item.topicId)}-${item.kind}@cherenkov.plan`,
      date: item.scheduledFor,
      summary: `${label(item.kind, lang)} · ${item.title}`,
      description: `${label(item.kind, otherLang)} · ${counterpart.title}`,
    });
  }

  if (main.stageDates && main.stageDates.start >= main.today) {
    const stage = STAGES[main.settings.stage];
    const year = main.settings.examYear;
    // "(provisional)" disappears by itself once dates are marked as verified.
    const wording = (l: CalendarLang) => `${stage.label[l]} ${year}${main.stageDates!.verifiedOn ? "" : ` (${PROVISIONAL[l]})`}`;
    events.push({
      uid: `cherenkov-plan-exam-${main.stageDates.start}-${main.settings.stage}@cherenkov.plan`,
      date: main.stageDates.start,
      summary: wording(lang),
      description: wording(otherLang),
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid));
}
