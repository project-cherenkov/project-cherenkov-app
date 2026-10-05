// Calendar-day arithmetic on "YYYY-MM-DD" strings, done in UTC so the result
// never depends on the machine's time zone or on daylight saving. (The
// older helpers in lib/plan-generator.ts use local time; they are private to
// that file and left as they are.)

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(isoDate: string): number {
  const match = ISO_DATE_RE.exec(isoDate);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function isIsoDate(value: string): boolean {
  const ms = toUtcMs(value);
  if (Number.isNaN(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number): string {
  const ms = toUtcMs(isoDate);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid date: ${isoDate}`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

// Whole days from `startIso` to `endIso` (negative when `endIso` is earlier).
export function daysBetween(startIso: string, endIso: string): number {
  const start = toUtcMs(startIso);
  const end = toUtcMs(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError(`Invalid date: ${startIso} / ${endIso}`);
  }
  return Math.round((end - start) / 86_400_000);
}

// Monday of the ISO week containing `isoDate`.
export function startOfWeek(isoDate: string): string {
  const ms = toUtcMs(isoDate);
  if (Number.isNaN(ms)) throw new RangeError(`Invalid date: ${isoDate}`);
  const weekday = new Date(ms).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return addDays(isoDate, -sinceMonday);
}
