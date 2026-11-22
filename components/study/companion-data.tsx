"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChatMeter } from "@/components/study/chat-meter";
import { useChatList } from "@/components/study/use-chat-list";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { Notice } from "@/components/ui/notice";
import { approximateKilobytes } from "@/lib/companion-chat-history";

/**
 * The Data section of Settings: how much chat history is stored, and a way to
 * delete all of it. It does not depend on the AI being switched on, so a
 * student who turns the AI off can still see and delete what is saved.
 */
export function CompanionData({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("companion");
  const { prefs } = useCompanionPrefs(signedIn);
  const { state, refresh } = useChatList(signedIn);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<"" | "done" | "error">("");
  const headingId = useId();

  if (!signedIn) return <p className="text-sm text-muted-foreground">{t("dataSignIn")}</p>;

  async function deleteAll() {
    setMessage("");
    try {
      const response = await fetch("/api/companion/chats", { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      setConfirming(false);
      setMessage("done");
    } catch {
      setMessage("error");
    }
    await refresh();
  }

  const usage = state.status === "ready" ? state.usage : null;
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4" aria-labelledby={headingId} role="group">
      <div>
        <h3 id={headingId} className="font-semibold text-foreground">{t("dataTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("dataDescription")}</p>
      </div>
      {state.status === "error" ? <Notice tone="danger" role="alert">{t("dataError")}</Notice> : null}
      {usage ? (
        <>
          <ChatMeter
            label={t("dataChats")}
            value={usage.chats}
            max={usage.maxChats}
            valueText={t("chatsMeter", { count: usage.chats, max: usage.maxChats })}
            style={prefs.style}
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t("dataMessages")}</dt>
            <dd className="tabular-nums">{usage.messages}</dd>
            <dt className="text-muted-foreground">{t("dataSize")}</dt>
            <dd className="tabular-nums">{t("dataSizeValue", { kb: approximateKilobytes(usage.characters) })}</dd>
          </dl>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("deleteAllChats")}>
              <span className="text-sm">{t("deleteAllConfirm", { count: usage.chats })}</span>
              <button type="button" onClick={() => void deleteAll()} className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-4 text-sm font-medium">{t("deleteConfirmYes")}</button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted">{t("cancel")}</button>
            </div>
          ) : (
            <button
              type="button"
              disabled={usage.chats === 0}
              onClick={() => { setMessage(""); setConfirming(true); }}
              className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {t("deleteAllChats")}
            </button>
          )}
        </>
      ) : null}
      <p role="status" className="min-h-5 text-sm text-muted-foreground">{message === "done" ? t("deleteAllDone") : ""}</p>
      {message === "error" ? <Notice tone="danger" role="alert">{t("dataError")}</Notice> : null}
    </div>
  );
}
