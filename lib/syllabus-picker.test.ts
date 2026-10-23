import { describe, expect, it } from "vitest";

import { buildPickerSubjects } from "./syllabus-picker";
import { SUBJECTS } from "./subjects";

describe("buildPickerSubjects", () => {
  const options = buildPickerSubjects("en", (subject) => subject.toUpperCase());

  it("lists every subject with its label", () => {
    expect(options.map((o) => o.subject)).toEqual([...SUBJECTS]);
    expect(options[0]!.label).toBe(SUBJECTS[0].toUpperCase());
  });

  it("only includes sections that have topics, with localized names", () => {
    for (const option of options) {
      expect(option.sections.length).toBeGreaterThan(0);
      for (const section of option.sections) {
        expect(section.topics.length).toBeGreaterThan(0);
        expect(section.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("is plain data (survives JSON, as props to a client component must)", () => {
    expect(JSON.parse(JSON.stringify(options))).toEqual(options);
  });
});
