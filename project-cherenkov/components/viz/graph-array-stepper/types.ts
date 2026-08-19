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
  return Array.isArray(c.array) && Array.isArray(c.steps);
}
