import { describe, expect, it } from "vitest";
import { buildPlanEvents } from "./calendar-plan";
import type { PlannerPageData } from "./plan-view";

type PlanData = Extract<PlannerPageData, { state: "plan" }>;

function plan(lang: "en" | "id", verifiedOn?: string): PlanData {
  const t = (en: string, id: string) => (lang === "en" ? en : id);
  const item = (id: string, scheduledFor: string, done: boolean, kind: "study" | "review" = "study") => ({
    id, topicId: `topic-${id}`, title: t(`Topic ${id}`, `Topik ${id}`), sectionName: "S", kind, reason: null, minutes: 45, scheduledFor, position: 0, done,
  });
  return {
    state: "plan",
    settings: { subject: "physics", stage: "osn_p", examYear: 2027, hoursPerWeek: 5, timezone: "Asia/Jakarta" },
    today: "2026-11-22",
    stageDates: { start: "2027-07-27", end: "2027-07-29", status: "projected", ...(verifiedOn ? { verifiedOn } : {}) },
    items: [item("past", "2026-11-21", false), item("done", "2026-11-23", true), item("today", "2026-11-22", false), item("later", "2026-12-01", false, "review")],
  } as unknown as PlanData;
}

describe("buildPlanEvents", () => {
  const events = buildPlanEvents(plan("en"), plan("id"), "en");
  it("keeps only upcoming, incomplete items, plus one exam-day event", () => {
    expect(events.map((e) => e.date)).toEqual(["2026-11-22", "2026-12-01", "2027-07-27"]);
  });
  it("titles in the chosen language and describes in the other", () => {
    expect(events[0]).toMatchObject({ summary: "Study · Topic today", description: "Belajar · Topik today" });
    const id = buildPlanEvents(plan("id"), plan("en"), "id")[0]!;
    expect(id.summary).toBe("Belajar · Topik today");
  });
  it("exposes nothing but event text: no minutes, reason or link", () => {
    for (const e of events) expect(Object.keys(e).sort()).toEqual(["date", "description", "summary", "uid"]);
    expect(JSON.stringify(events)).not.toContain("45");
  });
  it("marks an unverified exam date provisional, in both languages, until it is verified", () => {
    const exam = events.at(-1)!;
    expect(exam.summary).toBe("OSN province (OSN-P) 2027 (provisional)");
    expect(exam.description).toBe("OSN Provinsi (OSN-P) 2027 (sementara)");
    const verified = buildPlanEvents(plan("en", "2026-11-01"), plan("id", "2026-11-01"), "en").at(-1)!;
    expect(verified.summary).toBe("OSN province (OSN-P) 2027");
  });
  it("derives stable UIDs from date, topic and kind, not from item ids", () => {
    expect(events[1]!.uid).toBe("cherenkov-plan-2026-12-01-topic-later-review@cherenkov.plan");
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
  });
});
