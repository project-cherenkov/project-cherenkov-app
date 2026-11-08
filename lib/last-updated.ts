const commitTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:[+-]\d{2}:\d{2}|Z)$/;

export function formatCommitTimestamp(timestamp: string): string {
  const match = commitTimestampPattern.exec(timestamp);
  if (!match) {
    throw new Error(`Invalid commit timestamp: ${timestamp}`);
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

// The footer shows only the day, spelled out ("7 Nov 2026" / "Nov 7, 2026"):
// 07/11/2026 means 7 November to one reader and 11 July to another, and the
// site has English and Indonesian readers. The commit's own calendar day is
// kept (its offset is ignored, as in formatCommitTimestamp), so the date does
// not shift with the reader's timezone.
export function formatCommitDate(timestamp: string, locale: string): string {
  const match = commitTimestampPattern.exec(timestamp);
  if (!match) {
    throw new Error(`Invalid commit timestamp: ${timestamp}`);
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
