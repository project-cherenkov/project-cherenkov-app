type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

/**
 * Merges the per-feature message files of one locale into the single object
 * next-intl expects. Files may not share a top-level namespace: a duplicate
 * would silently shadow strings, which is exactly the bug JSON's own
 * duplicate-key rule hid in the old single-file catalogues.
 */
export function defineCatalogue<const Parts extends readonly Record<string, unknown>[]>(
  ...parts: Parts
): UnionToIntersection<Parts[number]> {
  const merged: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [namespace, value] of Object.entries(part)) {
      if (namespace in merged) {
        throw new Error(`Message namespace "${namespace}" is defined in more than one file`);
      }
      merged[namespace] = value;
    }
  }
  return merged as UnionToIntersection<Parts[number]>;
}
