// Frontmatter (and therefore vizConfig) is static YAML/JSON — it can't hold
// an actual "pure step function" as executable code. The practical
// equivalent: the editorial author precomputes every step's state up front,
// and the component's step function is just `steps[currentIndex]`, which
// *is* pure (same index always yields the same state, no mutation). Flag
// this reading back if a literal per-problem function was intended instead.
export interface StepperStep {
  /** Named pointers (e.g. { lo: 0, hi: 7, mid: 3 }) — key is the label shown
   *  under the array, value is the index into `array` it currently points to. */
  pointers: Record<string, number>;
  /** Indices to visually emphasize this step (e.g. the current comparison). */
  highlight?: number[];
  /** One-line explanation shown alongside this step. */
  note?: string;
}

export interface GraphArrayStepperConfig {
  array: number[];
  steps: StepperStep[];
}

export function isGraphArrayStepperConfig(
  config: unknown,
): config is GraphArrayStepperConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (
    !Array.isArray(c.array) ||
    !c.array.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    return false;
  }
  // CH-09 (architect audit round 1): every pointer/highlight index must be
  // in-bounds against `array`. Previously only checked "is an integer,"
  // which let an out-of-range index (e.g. 12 against a 6-element array)
  // pass validation and reach the renderer, where it silently failed to
  // draw instead of being rejected at this content-safety boundary.
  const arrayLength = c.array.length;
  const isInBounds = (index: number) => index >= 0 && index < arrayLength;
  return (
    Array.isArray(c.steps) &&
    c.steps.length > 0 &&
    c.steps.every((step) => {
      if (!step || typeof step !== "object") return false;
      const stepRecord = step as Record<string, unknown>;
      const pointers = stepRecord.pointers;
      if (
        pointers === null ||
        typeof pointers !== "object" ||
        !Object.values(pointers).every(
          (index) => typeof index === "number" && Number.isInteger(index) && isInBounds(index),
        )
      ) {
        return false;
      }
      const highlight = stepRecord.highlight;
      if (highlight === undefined) return true;
      return (
        Array.isArray(highlight) &&
        highlight.every(
          (index) => typeof index === "number" && Number.isInteger(index) && isInBounds(index),
        )
      );
    })
  );
}
