import { describe, expect, it } from "vitest";
import {
  saveSelfRatingsCore,
  savePlannerSettingsCore,
  validatePlannerSettings,
  validateSelfRatings,
  type PlannerSettings,
  type SelfRatingDeps,
  type SettingsDeps,
} from "./planner-settings";
import { getTopicCount } from "./syllabus";

const TODAY = "2026-10-04";
const GOOD = { subject: "physics", stage: "osn_k", examYear: 2027, hoursPerWeek: 6 };

describe("validatePlannerSettings", () => {
  it("accepts a valid submission and defaults the time zone to Jakarta", () => {
    expect(validatePlannerSettings(GOOD, TODAY)).toEqual({
      ok: true,
      value: { ...GOOD, timezone: "Asia/Jakarta" },
    });
  });

  it("rounds weekly hours to one decimal", () => {
    const r = validatePlannerSettings({ ...GOOD, hoursPerWeek: 6.26 }, TODAY);
    expect(r.ok && r.value.hoursPerWeek).toBe(6.3);
  });

  it.each([
    ["subject", { subject: "chemistry" }],
    ["subject", { subject: undefined }],
    ["stage", { stage: "nasional" }],
    ["examYear", { examYear: 2027.5 }],
    ["examYear", { examYear: "2027" }],
    ["examYear", { examYear: 2031 }], // no published dates
    ["hoursPerWeek", { hoursPerWeek: 0 }],
    ["hoursPerWeek", { hoursPerWeek: -3 }],
    ["hoursPerWeek", { hoursPerWeek: 81 }],
    ["hoursPerWeek", { hoursPerWeek: Number.NaN }],
    ["hoursPerWeek", { hoursPerWeek: "6" }],
    ["timezone", { timezone: "Mars/Olympus" }],
    ["timezone", { timezone: 7 }],
  ])("rejects a bad %s", (field, patch) => {
    const r = validatePlannerSettings({ ...GOOD, ...patch }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toContain(field);
  });

  it("rejects a stage that has already taken place, but not on its last day", () => {
    // OSN-K 2026 ended on 2026-06-19.
    const past = validatePlannerSettings({ ...GOOD, examYear: 2026 }, TODAY);
    expect(past.ok).toBe(false);
    const lastDay = validatePlannerSettings({ ...GOOD, examYear: 2026 }, "2026-06-19");
    expect(lastDay.ok).toBe(true);
  });

  it("reports every problem at once", () => {
    const r = validatePlannerSettings({ subject: "x", stage: "y", examYear: "z", hoursPerWeek: -1 }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["examYear", "hoursPerWeek", "stage", "subject"]);
  });

  it("does not throw on non-object input", () => {
    for (const bad of [null, undefined, "x", 5, []]) {
      expect(validatePlannerSettings(bad, TODAY).ok).toBe(false);
    }
  });
});

function makeSettingsDeps(initial: PlannerSettings | null) {
  let stored = initial;
  const deps: SettingsDeps = {
    getSettings: async () => stored,
    upsertSettings: async (_u, s) => {
      stored = s;
    },
  };
  return { deps, get: () => stored };
}

describe("savePlannerSettingsCore", () => {
  it("stores valid settings and reports no subject change on first save", async () => {
    const { deps, get } = makeSettingsDeps(null);
    expect(await savePlannerSettingsCore(deps, "u1", GOOD, TODAY)).toEqual({ ok: true, subjectChanged: false });
    expect(get()?.subject).toBe("physics");
  });

  it("flags a subject change but not a change of other fields", async () => {
    const { deps } = makeSettingsDeps({ ...GOOD, timezone: "Asia/Jakarta" } as PlannerSettings);
    expect(await savePlannerSettingsCore(deps, "u1", { ...GOOD, hoursPerWeek: 9 }, TODAY)).toEqual({ ok: true, subjectChanged: false });
    expect(await savePlannerSettingsCore(deps, "u1", { ...GOOD, subject: "astronomy" }, TODAY)).toEqual({ ok: true, subjectChanged: true });
  });

  it("stores nothing when the input is invalid", async () => {
    const { deps, get } = makeSettingsDeps(null);
    const r = await savePlannerSettingsCore(deps, "u1", { ...GOOD, hoursPerWeek: 0 }, TODAY);
    expect(r.ok).toBe(false);
    expect(get()).toBeNull();
  });
});

describe("validateSelfRatings", () => {
  it("accepts valid ratings", () => {
    const r = validateSelfRatings([{ syllabusTopicId: "vectors", rating: 3 }, { syllabusTopicId: "kinematics", rating: 5 }], "physics");
    expect(r.ok).toBe(true);
  });

  it.each([
    ["not a list", "vectors"],
    ["empty", []],
    ["unknown topic", [{ syllabusTopicId: "nope", rating: 3 }]],
    ["topic of another subject", [{ syllabusTopicId: "binary-search", rating: 3 }]],
    ["rating 0", [{ syllabusTopicId: "vectors", rating: 0 }]],
    ["rating 6", [{ syllabusTopicId: "vectors", rating: 6 }]],
    ["fractional rating", [{ syllabusTopicId: "vectors", rating: 2.5 }]],
    ["string rating", [{ syllabusTopicId: "vectors", rating: "3" }]],
    ["duplicate topic", [{ syllabusTopicId: "vectors", rating: 3 }, { syllabusTopicId: "vectors", rating: 4 }]],
    ["null entry", [null]],
  ])("rejects %s", (_label, input) => {
    expect(validateSelfRatings(input, "physics").ok).toBe(false);
  });

  it("rejects more ratings than the subject has topics", () => {
    const many = Array.from({ length: getTopicCount("physics") + 1 }, (_, i) => ({ syllabusTopicId: `t${i}`, rating: 3 }));
    expect(validateSelfRatings(many, "physics").ok).toBe(false);
  });
});

function makeRatingDeps(settings: PlannerSettings | null, seeded: Record<string, string>) {
  const saved: { userId: string; rows: { topicId: string; rating: number }[] }[] = [];
  const deps: SelfRatingDeps = {
    getSettings: async () => settings,
    getTopicRowIds: async (_subject, ids) => new Map(ids.filter((id) => id in seeded).map((id) => [id, seeded[id]!])),
    upsertRatings: async (userId, rows) => {
      saved.push({ userId, rows });
    },
  };
  return { deps, saved };
}

const PHYSICS_SETTINGS: PlannerSettings = { subject: "physics", stage: "osn_k", examYear: 2027, hoursPerWeek: 6, timezone: "Asia/Jakarta" };

describe("saveSelfRatingsCore", () => {
  it("maps syllabus ids to topic row ids and saves", async () => {
    const { deps, saved } = makeRatingDeps(PHYSICS_SETTINGS, { vectors: "uuid-v", kinematics: "uuid-k" });
    const r = await saveSelfRatingsCore(deps, "u1", [{ syllabusTopicId: "vectors", rating: 2 }, { syllabusTopicId: "kinematics", rating: 4 }]);
    expect(r).toEqual({ ok: true, saved: 2 });
    expect(saved[0]).toEqual({ userId: "u1", rows: [{ topicId: "uuid-v", rating: 2 }, { topicId: "uuid-k", rating: 4 }] });
  });

  it("requires planner settings first, because ratings belong to the chosen subject", async () => {
    const { deps, saved } = makeRatingDeps(null, {});
    expect(await saveSelfRatingsCore(deps, "u1", [{ syllabusTopicId: "vectors", rating: 2 }])).toEqual({ ok: false, reason: "no_settings" });
    expect(saved).toHaveLength(0);
  });

  it("rejects a topic from a different subject than the student's", async () => {
    const { deps, saved } = makeRatingDeps(PHYSICS_SETTINGS, { "binary-search": "uuid-b" });
    const r = await saveSelfRatingsCore(deps, "u1", [{ syllabusTopicId: "binary-search", rating: 2 }]);
    expect(r.ok === false && r.reason).toBe("invalid");
    expect(saved).toHaveLength(0);
  });

  it("saves nothing, rather than a subset, when a topic has no row yet", async () => {
    const { deps, saved } = makeRatingDeps(PHYSICS_SETTINGS, { vectors: "uuid-v" });
    const r = await saveSelfRatingsCore(deps, "u1", [{ syllabusTopicId: "vectors", rating: 2 }, { syllabusTopicId: "kinematics", rating: 4 }]);
    expect(r).toEqual({ ok: false, reason: "topics_not_seeded" });
    expect(saved).toHaveLength(0);
  });
});
