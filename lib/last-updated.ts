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
