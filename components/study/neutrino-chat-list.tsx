"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import type { ChatListState } from "@/components/study/use-chat-list";

/**
 * The saved-chat list shown in the Ask tab's AI mode: open one, delete one
 * (after a confirmation), or start a new chat.
 */
export function NeutrinoChatList({
  state,
  activeId,
  onOpen,
  onDelete,
  onNew,
}: {
  state: ChatListState;
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("companion");
  const locale = useLocale();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("chatsTitle")}</h3>
        <button type="button" onClick={onNew} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border-strong px-3 text-sm font-medium hover:bg-muted">
          <Plus className="h-4 w-4" aria-hidden /> {t("newChat")}
        </button>
      </div>
      {state.status === "error" ? <p role="alert" className="text-sm">{t("chatListError")}</p> : null}
      {state.status === "ready" && state.chats.length === 0 ? <p className="text-sm text-muted-foreground">{t("noChats")}</p> : null}
      {state.status === "ready" ? (
        <ul className="space-y-1">
          {state.chats.map((chat) => (
            <li key={chat.id} className="rounded-md border border-border">
              {confirmId === chat.id ? (
                <div className="flex flex-wrap items-center gap-2 p-2" role="group" aria-label={t("deleteChat", { title: chat.title })}>
                  <span className="text-sm">{t("deleteChatConfirm")}</span>
                  <button type="button" onClick={() => { setConfirmId(null); onDelete(chat.id); }} className="min-h-11 rounded-md border border-danger-border bg-danger-bg px-3 text-sm font-medium">{t("deleteConfirmYes")}</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="min-h-11 rounded-md border border-border-strong px-3 text-sm hover:bg-muted">{t("cancel")}</button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onOpen(chat.id)}
                    aria-current={chat.id === activeId ? "true" : undefined}
                    aria-label={t("openChat", { title: chat.title })}
                    className="min-h-11 min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="block truncate font-medium">{chat.title}</span>
                    <span className="block text-xs text-muted-foreground">{format.format(new Date(chat.updatedAt))}</span>
                  </button>
                  <button type="button" onClick={() => setConfirmId(chat.id)} aria-label={t("deleteChat", { title: chat.title })} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
