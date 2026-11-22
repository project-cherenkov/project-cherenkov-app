// iCalendar (RFC 5545) output for the planner's calendar export. Pure: no
// database, no clock (the caller passes `now`). Used by both the one-time
// download and the subscription feed.
import { addDays } from "./plan-dates";

export interface CalendarEvent {
  /** Stable and unique. A calendar app uses it to update an event, not duplicate it. */
  uid: string;
  /** All-day event on this "YYYY-MM-DD" date. */
  date: string;
  summary: string;
  description: string;
}

const CRLF = "\r\n";
const PRODID = "-//Project Cherenkov//Study plan//EN";

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Folds a content line so no line is longer than 75 octets (UTF-8), never
 * splitting a character. Continuation lines start with one space, which counts
 * towards their 75.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let used = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (used + size > limit) {
      parts.push(current);
      current = " ";
      used = 1;
      limit = 75;
    }
    current += char;
    used += size;
  }
  parts.push(current);
  return parts.join(CRLF);
}

function compactDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCalendar(options: {
  events: readonly CalendarEvent[];
  now: Date;
  /** A feed adds METHOD:PUBLISH and a calendar name; a one-time file does not. */
  feed?: { name: string };
}): string {
  const stamp = utcStamp(options.now);
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN"];
  if (options.feed) lines.push("METHOD:PUBLISH", `X-WR-CALNAME:${escapeText(options.feed.name)}`);
  for (const event of options.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      // An all-day end date is exclusive: the next day.
      `DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      // All-day study items must not mark the student as busy.
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
