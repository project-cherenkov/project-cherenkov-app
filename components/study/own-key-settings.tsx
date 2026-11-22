"use client";

import { FormEvent, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useOwnKey } from "@/components/study/use-own-key";
import { COMPANION_DAILY_LIMIT, COMPANION_PERSONAL_DAILY_LIMIT } from "@/lib/companion-settings";

/**
 * "Use my own Gemini key". The key is kept in this tab's sessionStorage only
 * (see use-own-key.ts) and goes through Cherenkov's server with each request.
 * While a key is set, every chat request carries it.
 */
export function OwnKeySettings() {
  const t = useTranslations("companion");
  const { key, setKey, clear } = useOwnKey();
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [removed, setRemoved] = useState(false);
  const id = useId();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || !draft.trim()) return;
    setKey(draft);
    setDraft("");
    setConsent(false);
    setRemoved(false);
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{t("ownKeyTitle")}</p>
      <p className="text-xs text-muted-foreground">
        {t("ownKeyHelp", { limit: COMPANION_DAILY_LIMIT, personalLimit: COMPANION_PERSONAL_DAILY_LIMIT })}
      </p>
      {key ? (
        <div className="flex flex-wrap items-center gap-2">
          <span role="status">{t("usingOwnKey")}</span>
          <button
            type="button"
            onClick={() => { clear(); setRemoved(true); }}
            className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted"
          >
            {t("ownKeyRemove")}
          </button>
        </div>
      ) : (
        <form className="space-y-2" onSubmit={save}>
          <label className="flex items-start gap-2 text-xs" htmlFor={`${id}-consent`}>
            <input id={`${id}-consent`} type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
            <span>{t("ownKeyConsent")}</span>
          </label>
          <label className="sr-only" htmlFor={`${id}-key`}>{t("ownKeyPlaceholder")}</label>
          <input
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={256}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("ownKeyPlaceholder")}
            className="h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!consent || !draft.trim()}
            className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {t("ownKeySave")}
          </button>
          {removed ? <p role="status" className="text-xs text-muted-foreground">{t("ownKeyRemoved")}</p> : null}
        </form>
      )}
    </div>
  );
}
