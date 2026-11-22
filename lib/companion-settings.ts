// Shared definition of the Neutrino companion's preferences. Used by the
// settings API (validation), the account page / companion panel (form), and
// the launcher (rendering), so the allowed values live in exactly one place.

export const COMPANION_NAME_MAX = 32;

// Study chat budget. Shared by the chat route (enforcement) and the FAQ
// (explanation), so the answer a student reads can never disagree with the
// limit the server applies.
export const COMPANION_DAILY_LIMIT = 10;
export const COMPANION_MAX_MESSAGE_CHARS = 1200;
export const COMPANION_MAX_HISTORY = 6;
// A ceiling on a reply, not a target: the prompt still asks for brief answers.
export const COMPANION_MAX_OUTPUT_TOKENS = 1500;
// Requests made with a student's own Gemini key do not count towards the daily
// limit above. They have their own, much larger ceiling that protects the
// server, not the student's wallet.
export const COMPANION_PERSONAL_DAILY_LIMIT = 200;
// Saved chat history.
export const COMPANION_MAX_CHATS = 15;
export const COMPANION_MAX_CHAT_MESSAGES = 30;
export const COMPANION_CHAT_TITLE_MAX = 40;
export const DEFAULT_COMPANION_NAME = "Neutrino";

// "smooth" is the look Neutrino has always had. "pixel" is the default.
export const COMPANION_STYLES = ["pixel", "smooth"] as const;
export type CompanionStyle = (typeof COMPANION_STYLES)[number];

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

export const MOTION_SPEED_MIN = 50;
export const MOTION_SPEED_MAX = 150;
export const MOTION_SPEED_STEP = 10;
export const DEFAULT_DRIFT_SPEED = 70;

export type CompanionPrefs = {
  name: string;
  enabled: boolean;
  // Turns off only the AI chat. The companion, its FAQ and its timer stay.
  aiEnabled: boolean;
  aiAcknowledged: boolean;
  updatesEnabled: boolean;
  size: CompanionSize;
  rotation: CompanionRotation;
  style: CompanionStyle;
  ambientMotion: boolean;
  driftSpeed: number;
  aiBannerDismissed: boolean;
  faqBannerDismissed: boolean;
};

export const DEFAULT_COMPANION_PREFS: CompanionPrefs = {
  name: DEFAULT_COMPANION_NAME,
  enabled: true,
  aiEnabled: true,
  aiAcknowledged: false,
  updatesEnabled: true,
  size: "medium",
  rotation: "auto",
  style: "pixel",
  ambientMotion: true,
  driftSpeed: DEFAULT_DRIFT_SPEED,
  aiBannerDismissed: false,
  faqBannerDismissed: false,
};

export type CompanionPatch = Partial<CompanionPrefs>;

export function isCompanionSize(value: unknown): value is CompanionSize {
  return typeof value === "string" && (COMPANION_SIZES as readonly string[]).includes(value);
}

export function isCompanionRotation(value: unknown): value is CompanionRotation {
  return typeof value === "string" && (COMPANION_ROTATIONS as readonly string[]).includes(value);
}

export function isCompanionStyle(value: unknown): value is CompanionStyle {
  return typeof value === "string" && (COMPANION_STYLES as readonly string[]).includes(value);
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
  if ("aiEnabled" in input) {
    if (typeof input.aiEnabled !== "boolean") return null;
    patch.aiEnabled = input.aiEnabled;
  }
  if ("aiAcknowledged" in input) {
    if (typeof input.aiAcknowledged !== "boolean") return null;
    patch.aiAcknowledged = input.aiAcknowledged;
  }
  if ("updatesEnabled" in input) {
    if (typeof input.updatesEnabled !== "boolean") return null;
    patch.updatesEnabled = input.updatesEnabled;
  }
  if ("size" in input) {
    if (!isCompanionSize(input.size)) return null;
    patch.size = input.size;
  }
  if ("rotation" in input) {
    if (!isCompanionRotation(input.rotation)) return null;
    patch.rotation = input.rotation;
  }
  if ("style" in input) {
    if (!isCompanionStyle(input.style)) return null;
    patch.style = input.style;
  }
  if ("aiBannerDismissed" in input) {
    if (typeof input.aiBannerDismissed !== "boolean") return null;
    patch.aiBannerDismissed = input.aiBannerDismissed;
  }
  if ("faqBannerDismissed" in input) {
    if (typeof input.faqBannerDismissed !== "boolean") return null;
    patch.faqBannerDismissed = input.faqBannerDismissed;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Builds a complete, valid prefs object from untrusted data (storage, API). */
export function normalizeCompanionPrefs(raw: unknown): CompanionPrefs {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const speed = typeof input.driftSpeed === "number" && Number.isFinite(input.driftSpeed)
    ? Math.min(MOTION_SPEED_MAX, Math.max(MOTION_SPEED_MIN, Math.round(input.driftSpeed / MOTION_SPEED_STEP) * MOTION_SPEED_STEP))
    : DEFAULT_COMPANION_PREFS.driftSpeed;
  return {
    name: normalizeCompanionName(input.name) ?? DEFAULT_COMPANION_PREFS.name,
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_COMPANION_PREFS.enabled,
    aiEnabled: typeof input.aiEnabled === "boolean" ? input.aiEnabled : DEFAULT_COMPANION_PREFS.aiEnabled,
    aiAcknowledged: typeof input.aiAcknowledged === "boolean" ? input.aiAcknowledged : DEFAULT_COMPANION_PREFS.aiAcknowledged,
    updatesEnabled: typeof input.updatesEnabled === "boolean" ? input.updatesEnabled : DEFAULT_COMPANION_PREFS.updatesEnabled,
    size: isCompanionSize(input.size) ? input.size : DEFAULT_COMPANION_PREFS.size,
    rotation: isCompanionRotation(input.rotation) ? input.rotation : DEFAULT_COMPANION_PREFS.rotation,
    style: isCompanionStyle(input.style) ? input.style : DEFAULT_COMPANION_PREFS.style,
    ambientMotion: typeof input.ambientMotion === "boolean" ? input.ambientMotion : DEFAULT_COMPANION_PREFS.ambientMotion,
    driftSpeed: speed,
    aiBannerDismissed: typeof input.aiBannerDismissed === "boolean" ? input.aiBannerDismissed : DEFAULT_COMPANION_PREFS.aiBannerDismissed,
    faqBannerDismissed: typeof input.faqBannerDismissed === "boolean" ? input.faqBannerDismissed : DEFAULT_COMPANION_PREFS.faqBannerDismissed,
  };
}
