"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeHomeVizPicks,
  parseHomeVizPicks,
  readLocalHomeVizPicks,
  writeLocalHomeVizPicks,
} from "@/lib/home-viz-picks";

const ENDPOINT = "/api/home/viz-picks";

// Touching window.localStorage can itself throw (blocked storage), so even the
// lookup is guarded.
function deviceStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The visitor's chosen home visualizations.
 *
 * Signed out: kept in this browser only. Signed in: kept in the browser first
 * (instant, and still there if the network is not) and then in the account.
 * On sign-in the account's selection wins when it has one; otherwise the
 * selection made on this device is uploaded (see mergeHomeVizPicks).
 *
 * `saved` is the raw selection (null = none, use the defaults); the caller
 * resolves it against what is currently published. `ready` turns true after
 * the device value has been read, so the page can avoid flashing the defaults
 * at a returning visitor. A failed network call never loses the choice: the
 * device copy stays.
 */
export function useHomeVizPicks(signedIn: boolean) {
  const [saved, setSaved] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  // Set once the visitor changes the selection themselves, so a slower account
  // response never overwrites what they have just chosen.
  const touched = useRef(false);

  useEffect(() => {
    setSaved(readLocalHomeVizPicks(deviceStorage()));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!signedIn || !ready) return;
    let cancelled = false;
    fetch(ENDPOINT, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { picks?: unknown } | null) => {
        if (cancelled || !data || touched.current) return;
        const { picks, upload } = mergeHomeVizPicks(
          readLocalHomeVizPicks(deviceStorage()),
          parseHomeVizPicks(data.picks),
        );
        if (!picks) return;
        setSaved(picks);
        writeLocalHomeVizPicks(deviceStorage(), picks);
        if (upload) {
          void fetch(ENDPOINT, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ picks }),
          }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn, ready]);

  /** Pass null to go back to the defaults. */
  const save = useCallback(
    (next: readonly string[] | null) => {
      const picks = next === null ? null : parseHomeVizPicks(next);
      if (next !== null && !picks) return;
      touched.current = true;
      setSaved(picks);
      writeLocalHomeVizPicks(deviceStorage(), picks);
      if (!signedIn) return;
      const request =
        picks === null
          ? fetch(ENDPOINT, { method: "DELETE" })
          : fetch(ENDPOINT, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ picks }),
            });
      void request.catch(() => undefined);
    },
    [signedIn],
  );

  return { saved, ready, save };
}
