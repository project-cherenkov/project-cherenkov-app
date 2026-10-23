"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { deleteStudySession } from "@/lib/study-session-actions";

export interface SessionListItem {
  id: string;
  when: string; // already formatted for the student's locale and zone
  minutes: number;
  topicLabel: string | null;
  source: "timer" | "manual";
}

// Recent study sessions, each deletable (a mis-entered manual session should
// not be permanent). Deleting a session only removes minutes studied: it
// changes nothing about mastery or the plan.
export function SessionList({ items }: { items: SessionListItem[] }) {
  const t = useTranslations("progress");
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    setError(false);
    startTransition(async () => {
      const result = await deleteStudySession(id);
      if (result.ok) setRemoved((prev) => new Set(prev).add(id));
      else setError(true);
    });
  }

  const visible = items.filter((item) => !removed.has(item.id));
  if (visible.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">{t("sessions.empty")}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-foreground">{t("minutes", { minutes: item.minutes })}</span>
              <span className="ml-2 text-slate-600 dark:text-slate-400">
                {item.when}
                {item.topicLabel ? ` · ${item.topicLabel}` : ""}
                {item.source === "manual" ? ` · ${t("sessions.manual")}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              disabled={pending}
              className="min-h-9 shrink-0 rounded px-2 text-xs text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
            >
              {t("sessions.delete")}
              <span className="sr-only"> {item.when}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t("sessions.deleteError")}
        </p>
      ) : null}
    </>
  );
}
