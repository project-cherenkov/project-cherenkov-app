// Shared definition of the Neutrino companion's preferences. Used by the
// settings API (validation), the account page / companion panel (form), and
// the launcher (rendering), so the allowed values live in exactly one place.

export const COMPANION_NAME_MAX = 32;
export const DEFAULT_COMPANION_NAME = "Neutrino";

export const COMPANION_SIZES = ["small", "medium", "large"] as const;
export type CompanionSize = (typeof COMPANION_SIZES)[number];

// Every size keeps the draggable mascot at or above a 44px touch target.
export const COMPANION_SIZE_PX: Record<CompanionSize, number> = {
  small: 56,
  medium: 76,
  large: 104,
};

// "auto" renders the 3D lattice and silently drops to the flat (CSS-only)
// rotation if the device cannot keep up. "3d" and "flat" force one of them.
export const COMPANION_ROTATIONS = ["auto", "3d", "flat"] as const;
export type CompanionRotation = (typeof COMPANION_ROTATIONS)[number];

export type CompanionPrefs = {
  name: string;
  enabled: boolean;
  size: CompanionSize;
  rotation: CompanionRotation;
};

export const DEFAULT_COMPANION_PREFS: CompanionPrefs = {
  name: DEFAULT_COMPANION_NAME,
  enabled: true,
  size: "medium",
  rotation: "auto",
};

export type CompanionPatch = Partial<CompanionPrefs>;

export function isCompanionSize(value: unknown): value is CompanionSize {
  return typeof value === "string" && (COMPANION_SIZES as readonly string[]).includes(value);
}

export function isCompanionRotation(value: unknown): value is CompanionRotation {
  return typeof value === "string" && (COMPANION_ROTATIONS as readonly string[]).includes(value);
}

export function normalizeCompanionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > COMPANION_NAME_MAX) return null;
  return trimmed;
}

/**
 * Validates a PATCH body. Returns only the recognised, valid fields, or null
 * when the body is not an object, contains an invalid value, or has nothing to
 * change. An invalid value rejects the whole request rather than being
 * silently dropped, so a client bug is visible instead of half-applied.
 */
export function parseCompanionPatch(body: unknown): CompanionPatch | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const patch: CompanionPatch = {};

  if ("name" in input) {
    const name = normalizeCompanionName(input.name);
    if (name === null) return null;
    patch.name = name;
  }
  if ("enabled" in input) {
    if (typeof input.enabled !== "boolean") return null;
    patch.enabled = input.enabled;
  }
  if ("size" in input) {
    if (!isCompanionSize(input.size)) return null;
    patch.size = input.size;
  }
  if ("rotation" in input) {
    if (!isCompanionRotation(input.rotation)) return null;
    patch.rotation = input.rotation;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Builds a complete, valid prefs object from untrusted data (storage, API). */
export function normalizeCompanionPrefs(raw: unknown): CompanionPrefs {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    name: normalizeCompanionName(input.name) ?? DEFAULT_COMPANION_PREFS.name,
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_COMPANION_PREFS.enabled,
    size: isCompanionSize(input.size) ? input.size : DEFAULT_COMPANION_PREFS.size,
    rotation: isCompanionRotation(input.rotation) ? input.rotation : DEFAULT_COMPANION_PREFS.rotation,
  };
}
