export function sanitizeBlobPathSegment(value: string): string {
  const normalized = value
    .replace(/\\/g, "/")
    .split("/")
    .pop() ?? "upload";

  const cleaned = normalized
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\s+/g, "-");

  const lastDot = cleaned.lastIndexOf(".");
  if (lastDot > 0 && lastDot < cleaned.length - 1) {
    const stem = cleaned.slice(0, lastDot).replace(/[-_.]+$/g, "");
    const extension = cleaned
      .slice(lastDot + 1)
      .replace(/[^a-zA-Z0-9]+/g, "")
      .replace(/[-_.]+$/g, "");

    if (stem && extension) {
      return `${stem}.${extension}`.replace(/[-_.]+$/g, "");
    }
  }

  const fallback = cleaned.replace(/\.+/g, ".").replace(/[-_.]+$/g, "");
  return fallback || "upload";
}
