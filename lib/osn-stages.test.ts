import { describe, expect, it } from "vitest";
import { QUESTION_DIFFICULTIES } from "./planner-vocab";
import {
  getStageWindow,
  getUpcomingStageWindow,
  isOsnStage,
  isValidTimeZone,
  OSN_STAGES,
  SCHEDULE_YEARS,
  STAGES,
  todayInTimeZone,
} from "./osn-stages";

function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return date.toISOString().slice(0, 10) === iso;
}

describe("stage schedule", () => {
  it("has the owner's 2026 dates", () => {
    expect(getStageWindow("osn_k", 2026)).toMatchObject({ start: "2026-06-18", end: "2026-06-19", status: "user-provided" });
    expect(getStageWindow("osn_p", 2026)).toMatchObject({ start: "2026-07-27", end: "2026-07-29" });
    expect(getStageWindow("semifinal", 2026)).toMatchObject({ start: "2026-08-12", end: "2026-08-12" });
    expect(getStageWindow("final", 2026)).toMatchObject({ start: "2026-09-14", end: "2026-09-20" });
  });

  it("reuses the same calendar dates for 2027 and marks them projected, not official", () => {
    for (const stage of OSN_STAGES) {
      const w26 = getStageWindow(stage, 2026)!;
      const w27 = getStageWindow(stage, 2027)!;
      expect(w27.start.slice(4)).toBe(w26.start.slice(4));
      expect(w27.end.slice(4)).toBe(w26.end.slice(4));
      expect(w27.status).toBe("projected");
    }
  });

  it("returns nothing for a year the site has no dates for", () => {
    expect(getStageWindow("final", 2031)).toBeUndefined();
  });

  it("uses real calendar dates, start <= end, with the stages in chronological order", () => {
    for (const year of Object.keys(SCHEDULE_YEARS).map(Number)) {
      let previousEnd = "";
      for (const stage of OSN_STAGES) {
        const w = getStageWindow(stage, year)!;
        expect(isRealDate(w.start) && isRealDate(w.end), `${stage} ${year}`).toBe(true);
        expect(w.start <= w.end).toBe(true);
        expect(w.start > previousEnd).toBe(true);
        previousEnd = w.end;
      }
    }
  });
});

describe("getUpcomingStageWindow", () => {
  it("picks 2026 while the stage has not finished", () => {
    expect(getUpcomingStageWindow("final", "2026-09-01")?.year).toBe(2026);
    expect(getUpcomingStageWindow("osn_k", "2026-06-19")?.year).toBe(2026); // last day still counts
  });

  it("rolls over to the next listed year once the stage is over", () => {
    expect(getUpcomingStageWindow("osn_k", "2026-06-20")?.year).toBe(2027);
    expect(getUpcomingStageWindow("final", "2026-10-03")?.year).toBe(2027);
  });

  it("returns null when no listed year has an unfinished window", () => {
    expect(getUpcomingStageWindow("final", "2027-12-31")).toBeNull();
  });
});

describe("stage difficulty ranges", () => {
  it("define a valid, non-inverted range for every stage", () => {
    for (const stage of OSN_STAGES) {
      const { min, max } = STAGES[stage].difficulty;
      expect(QUESTION_DIFFICULTIES.indexOf(min)).toBeGreaterThanOrEqual(0);
      expect(QUESTION_DIFFICULTIES.indexOf(min)).toBeLessThanOrEqual(QUESTION_DIFFICULTIES.indexOf(max));
    }
  });

  it("never get easier as the stage gets harder", () => {
    let previous = -1;
    for (const stage of OSN_STAGES) {
      const top = QUESTION_DIFFICULTIES.indexOf(STAGES[stage].difficulty.max);
      expect(top).toBeGreaterThanOrEqual(previous);
      previous = top;
    }
  });

  it("keeps mastery targets in (0, 1] and non-decreasing", () => {
    let previous = 0;
    for (const stage of OSN_STAGES) {
      const t = STAGES[stage].masteryTarget;
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(1);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  it("isOsnStage accepts only known stages", () => {
    expect(isOsnStage("osn_k")).toBe(true);
    expect(isOsnStage("nasional")).toBe(false);
  });
});

describe("todayInTimeZone", () => {
  it("is already the next day in Jakarta when it is evening in UTC", () => {
    expect(todayInTimeZone(new Date("2026-10-03T18:00:00Z"))).toBe("2026-10-04");
    expect(todayInTimeZone(new Date("2026-10-03T18:00:00Z"), "UTC")).toBe("2026-10-03");
  });

  it("rolls over to the next day exactly at 17:00 UTC (midnight in Jakarta)", () => {
    expect(todayInTimeZone(new Date("2026-10-03T16:59:00Z"))).toBe("2026-10-03");
    expect(todayInTimeZone(new Date("2026-10-03T17:00:00Z"))).toBe("2026-10-04");
  });

  it("validates time zone names", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("difficultiesForStage", () => {
  it("returns the inclusive difficulty range of each stage, easiest first", async () => {
    const { difficultiesForStage } = await import("./osn-stages");
    expect(difficultiesForStage("osn_k")).toEqual(["basic", "intermediate"]);
    expect(difficultiesForStage("osn_p")).toEqual(["intermediate", "advanced"]);
    expect(difficultiesForStage("semifinal")).toEqual(["advanced"]);
    expect(difficultiesForStage("final")).toEqual(["advanced"]);
  });
});
