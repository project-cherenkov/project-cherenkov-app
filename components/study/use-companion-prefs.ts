"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_COMPANION_PREFS,
  normalizeCompanionPrefs,
  type CompanionPatch,
  type CompanionPrefs,
} from "@/lib/companion-settings";

// Every place that shows or edits the preferences (the mascot, the companion's
// settings tab, the account page) has its own copy of this hook. They stay in
// sync through one window event, so no shared React provider is needed.
const CHANGE_EVENT = "neutrino-prefs-changed";
const STORAGE_KEY = "neutrino-prefs-v1";

// Per-device values that make sense without an account. Name and "enabled"
// are account features and are never read from or written to local storage.
function readLocal(): Partial<CompanionPrefs> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const { size, rotation } = normalizeCompanionPrefs(JSON.parse(raw));
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...("size" in parsed ? { size } : {}),
      ...("rotation" in parsed ? { rotation } : {}),
    };
  } catch {
    return {};
  }
}

function writeLocal(prefs: CompanionPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ size: prefs.size, rotation: prefs.rotation }));
  } catch {
    // Private mode / blocked storage: the setting just lasts for this page view.
  }
}

export type PrefsSaveResult = "saved" | "local" | "error";

/**
 * @param signedIn   whether an account is available to store the preferences
 * @param initial    server-rendered prefs (account page) to avoid a flash
 */
export function useCompanionPrefs(signedIn: boolean, initial?: CompanionPrefs) {
  const [prefs, setPrefs] = useState<CompanionPrefs>(initial ?? DEFAULT_COMPANION_PREFS);
  const [ready, setReady] = useState(Boolean(initial));
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Load: device values first (instant, works signed out), then the account.
  useEffect(() => {
    let cancelled = false;
    if (!initial) setPrefs((current) => ({ ...current, ...readLocal() }));
    if (!signedIn) {
      setPrefs((current) => ({ ...current, name: DEFAULT_COMPANION_PREFS.name, enabled: true }));
      setReady(true);
      return;
    }
    if (initial) {
      setReady(true);
      return;
    }
    fetch("/api/companion/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data) return;
        setPrefs(normalizeCompanionPrefs(data));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
    // `initial` only seeds the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<CompanionPrefs>).detail;
      if (next) setPrefs(normalizeCompanionPrefs(next));
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  /**
   * Applies a change immediately (so sliders and toggles feel instant), then
   * stores it. Signed out: device only. Signed in: the account; if that
   * fails the previous values are restored.
   */
  const update = useCallback(
    async (patch: CompanionPatch): Promise<PrefsSaveResult> => {
      const previous = prefsRef.current;
      // Signed-out visitors cannot change account-only fields.
      const effective: CompanionPatch = signedIn
        ? patch
        : { ...(patch.size ? { size: patch.size } : {}), ...(patch.rotation ? { rotation: patch.rotation } : {}) };
      const next = { ...previous, ...effective };
      setPrefs(next);
      writeLocal(next);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
      if (!signedIn) return "local";
      try {
        const response = await fetch("/api/companion/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(effective),
        });
        if (!response.ok) throw new Error("save failed");
        const saved = normalizeCompanionPrefs(await response.json());
        setPrefs(saved);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: saved }));
        return "saved";
      } catch {
        setPrefs(previous);
        writeLocal(previous);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: previous }));
        return "error";
      }
    },
    [signedIn],
  );

  return { prefs, ready, update };
}
