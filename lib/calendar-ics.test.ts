import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine } from "./calendar-ics";

const now = new Date("2026-11-22T10:15:30.456Z");
const event = { uid: "u1@cherenkov.plan", date: "2026-12-31", summary: "Study · Doppler, shift; 1", description: "Belajar · Doppler" };

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and newlines", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("keeps every line within 75 octets and never splits a character", () => {
    const folded = foldLine(`SUMMARY:${"é€😀".repeat(40)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é€😀".repeat(40)}`);
  });
  it("leaves a short line alone", () => expect(foldLine("BEGIN:VCALENDAR")).toBe("BEGIN:VCALENDAR"));
});

describe("buildCalendar", () => {
  const text = buildCalendar({ events: [event], now });
  it("uses CRLF and the required calendar properties", () => {
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.split("\r\n").every((line) => !line.includes("\n"))).toBe(true);
    expect(text).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:");
    expect(text).toContain("CALSCALE:GREGORIAN");
    expect(text).not.toContain("METHOD:PUBLISH");
  });
  it("writes all-day events with an exclusive end date across a year boundary", () => {
    expect(text).toContain("DTSTART;VALUE=DATE:20261231");
    expect(text).toContain("DTEND;VALUE=DATE:20270101");
    expect(text).toContain("DTSTAMP:20261122T101530Z");
    expect(text).toContain("UID:u1@cherenkov.plan");
  });
  it("marks events transparent and adds no alarm", () => {
    expect(text).toContain("TRANSP:TRANSPARENT");
    expect(text).not.toContain("VALARM");
  });
  it("escapes text values", () => {
    expect(text).toContain("SUMMARY:Study · Doppler\\, shift\\; 1");
  });
  it("adds METHOD and a name for a feed", () => {
    const feed = buildCalendar({ events: [], now, feed: { name: "Cherenkov study plan" } });
    expect(feed).toContain("METHOD:PUBLISH");
    expect(feed).toContain("X-WR-CALNAME:Cherenkov study plan");
  });
});
