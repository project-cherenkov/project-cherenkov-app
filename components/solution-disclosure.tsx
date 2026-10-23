"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  TRY_FIRST_EVENT,
  TRY_FIRST_STORAGE_KEY,
  parseTryFirst,
  serializeTryFirst,
} from "@/lib/try-first";

// --- A tiny external store over localStorage --------------------------------
// useSyncExternalStore keeps every <Solution /> and the toggle in step, across
// tabs too (the "storage" event), without a context provider. The server
// snapshot is `false`, so the server HTML — and the first client render — show
// the full solution; only readers who opted in see it collapse afterwards.

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(TRY_FIRST_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TRY_FIRST_EVENT, onChange);
  };
}

function getSnapshot(): boolean {
  try {
    return parseTryFirst(window.localStorage.getItem(TRY_FIRST_STORAGE_KEY));
  } catch {
    return false; // storage blocked: behave as "off"
  }
}

function setTryFirst(on: boolean) {
  try {
    window.localStorage.setItem(TRY_FIRST_STORAGE_KEY, serializeTryFirst(on));
  } catch {
    // Storage blocked (private mode, policy). The toggle then does nothing
    // persistent, which is harmless: solutions stay visible.
  }
  window.dispatchEvent(new Event(TRY_FIRST_EVENT));
}

function useTryFirst(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// Wraps a worked solution or proof in editorial MDX:
//
//   <Solution>
//   ## Full proof
//   ...
//   </Solution>
//
// Without the opt-in it renders its children untouched. With it, the content
// sits behind a native <details> disclosure (keyboard and screen-reader
// accessible, and still in the DOM).
export function Solution({ children }: { children?: ReactNode }) {
  const t = useTranslations("editorial");
  const tryFirst = useTryFirst();
  if (!tryFirst) return <>{children}</>;
  return (
    <details className="not-prose group my-6 rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer select-none font-mono text-sm font-semibold text-foreground">
        <span className="group-open:hidden">{t("showSolution")}</span>
        <span className="hidden group-open:inline">{t("hideSolution")}</span>
      </summary>
      {/* Back to prose styling inside the disclosure. */}
      <div className="prose prose-slate mt-4 max-w-none dark:prose-invert">{children}</div>
    </details>
  );
}

// The opt-in switch. Rendered above an editorial body only when that body
// actually contains a <Solution> (see components/editorial-mdx.tsx).
export function TryFirstToggle() {
  const t = useTranslations("editorial");
  const tryFirst = useTryFirst();
  return (
    <label className="not-prose mb-6 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
      <input
        type="checkbox"
        checked={tryFirst}
        onChange={(event) => setTryFirst(event.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span>
        <span className="font-medium text-foreground">{t("tryFirstLabel")}</span>
        <span className="block text-slate-600 dark:text-slate-400">{t("tryFirstHint")}</span>
      </span>
    </label>
  );
}
