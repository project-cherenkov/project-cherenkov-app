"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Notice } from "@/components/ui/notice";

type FeedStatus = { status: "loading" } | { status: "error" } | { status: "none" } | { status: "active"; lang: "en" | "id"; lastFetchedAt: string | null };
type FreshLinks = { url: string; webcalUrl: string };
type Lang = "en" | "id";

/**
 * Two ways to put the plan in a calendar app:
 *   A. a one-time .ics file (a snapshot), or
 *   B. a private subscription link the calendar app refreshes.
 * The link is shown once, when it is created or regenerated: only its hash is
 * stored, so it cannot be shown again. Used on the plan page and in
 * Settings, Account, Calendar.
 */
export function CalendarExport({ variant }: { variant: "plan" | "settings" }) {
  const t = useTranslations("account.calendar");
  const locale = useLocale();
  const [feed, setFeed] = useState<FeedStatus>({ status: "loading" });
  const [lang, setLang] = useState<Lang>(locale === "id" ? "id" : "en");
  const [fresh, setFresh] = useState<FreshLinks | null>(null);
  const [copied, setCopied] = useState<"" | "https" | "webcal" | "failed">("");
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const id = useId();

  async function load() {
    try {
      const response = await fetch("/api/calendar/feed", { cache: "no-store" });
      const data: { active?: boolean; lang?: Lang; lastFetchedAt?: string | null } = await response.json();
      if (!response.ok) throw new Error("status failed");
      if (data.active) {
        setFeed({ status: "active", lang: data.lang === "id" ? "id" : "en", lastFetchedAt: data.lastFetchedAt ?? null });
        if (data.lang) setLang(data.lang);
      } else setFeed({ status: "none" });
    } catch {
      setFeed({ status: "error" });
    }
  }
  useEffect(() => { void load(); }, []);

  async function call(method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/calendar/feed", {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("request failed");
      return data as Partial<FreshLinks>;
    } catch {
      setError(true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createOrRegenerate() {
    const data = await call("POST", { lang });
    if (data?.url && data.webcalUrl) {
      setFresh({ url: data.url, webcalUrl: data.webcalUrl });
      setCopied("");
      await load();
    }
  }
  async function turnOff() {
    if (await call("DELETE")) {
      setFresh(null);
      setConfirmOff(false);
      setFeed({ status: "none" });
    }
  }
  async function changeLang(next: Lang) {
    setLang(next);
    if (feed.status === "active") {
      const ok = await call("PATCH", { lang: next });
      if (ok) await load();
    }
  }
  async function copy(kind: "https" | "webcal") {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(kind === "https" ? fresh.url : fresh.webcalUrl);
      setCopied(kind);
    } catch {
      setCopied("failed");
    }
  }

  const button = "min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";
  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-4 text-sm" data-variant={variant}>
      <fieldset className="space-y-2">
        <legend className="font-medium">{t("langLegend")}</legend>
        <p className="text-xs text-muted-foreground">{t("langHelp")}</p>
        <div className="flex gap-4">
          {(["en", "id"] as const).map((value) => (
            <label key={value} className="inline-flex min-h-11 items-center gap-2">
              <input type="radio" name={`${id}-lang`} value={value} checked={lang === value} onChange={() => void changeLang(value)} />
              {t(`lang.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby={`${id}-a`} className="space-y-2">
        <h3 id={`${id}-a`} className="font-medium">{t("fileTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("fileHelp")}</p>
        <a href={`/api/calendar/download?lang=${lang}`} download="cherenkov-plan.ics" className={`${button} inline-flex items-center`}>{t("fileButton")}</a>
      </section>

      <section aria-labelledby={`${id}-b`} className="space-y-2">
        <h3 id={`${id}-b`} className="font-medium">{t("feedTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("feedHelp")}</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>{t("feedDelay")}</li>
          <li>{t("feedSecret")}</li>
        </ul>
        {feed.status === "error" ? <Notice tone="danger" role="alert">{t("error")}</Notice> : null}
        {feed.status === "active" && !fresh ? <p role="status">{t("feedActive")}</p> : null}
        {fresh ? (
          <div className="space-y-2 rounded-md border border-warning-border bg-warning-bg p-3" role="status">
            <p className="font-medium">{t("linkOnce")}</p>
            {([["https", fresh.url], ["webcal", fresh.webcalUrl]] as const).map(([kind, value]) => (
              <div key={kind} className="space-y-1">
                <label className="text-xs" htmlFor={`${id}-${kind}`}>{t(kind === "https" ? "linkHttps" : "linkWebcal")}</label>
                <div className="flex gap-2">
                  <input id={`${id}-${kind}`} readOnly value={value} onFocus={(event) => event.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-md border border-border-strong bg-background px-3 font-mono text-xs" />
                  <button type="button" onClick={() => void copy(kind)} className={button}>{t("copy")}</button>
                </div>
              </div>
            ))}
            <p aria-live="polite" className="min-h-4 text-xs">{copied === "failed" ? t("copyFailed") : copied ? t("copied") : ""}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {feed.status === "none" || feed.status === "loading" ? (
            <button type="button" disabled={busy || feed.status === "loading"} onClick={() => void createOrRegenerate()} className={button}>{t("create")}</button>
          ) : null}
          {feed.status === "active" ? (
            <>
              <button type="button" disabled={busy} onClick={() => void createOrRegenerate()} className={button}>{t("regenerate")}</button>
              {confirmOff ? (
                <span className="flex flex-wrap items-center gap-2" role="group" aria-label={t("turnOff")}>
                  <span>{t("turnOffConfirm")}</span>
                  <button type="button" disabled={busy} onClick={() => void turnOff()} className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-4 text-sm font-medium">{t("turnOffYes")}</button>
                  <button type="button" onClick={() => setConfirmOff(false)} className={button}>{t("cancel")}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmOff(true)} className={button}>{t("turnOff")}</button>
              )}
            </>
          ) : null}
        </div>
        {feed.status === "active" ? <p className="text-xs text-muted-foreground">{t("regenerateHelp")}</p> : null}
        {error ? <Notice tone="danger" role="alert">{t("error")}</Notice> : null}
      </section>
    </div>
  );
}
