"use client";

import { Input } from "@/components/ui/input";
import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { logStudySession } from "@/lib/study-session-actions";
import { TopicPicker, type PickerPlanItem, type PickerSubject, type PickerValue } from "./topic-picker";

// "datetime-local" value for an instant, in the browser's own time zone.
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Logging time studied away from the timer (a lecture, a problem set on
// paper). Signed-in only; the server applies the same rules as for the timer
// (not in the future, at most 12 hours, no overlap with another session).
export function ManualSessionForm({
  subjects,
  planItems,
}: {
  subjects: PickerSubject[];
  planItems: PickerPlanItem[];
}) {
  const t = useTranslations("timer");
  const [minutes, setMinutes] = useState("30");
  const [startedAt, setStartedAt] = useState(() => toLocalInput(Date.now() - 30 * 60_000));
  const [target, setTarget] = useState<PickerValue>({ subject: "", syllabusTopicId: "", planItemId: "" });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const durationMinutes = Number(minutes);
    const startedAtMs = new Date(startedAt).getTime();
    if (!Number.isInteger(durationMinutes) || Number.isNaN(startedAtMs)) {
      setMessage({ kind: "error", text: t("errors.invalid") });
      return;
    }
    startTransition(async () => {
      const result = await logStudySession({
        startedAtMs,
        durationSeconds: durationMinutes * 60,
        source: "manual",
        subject: target.subject || null,
        syllabusTopicId: target.syllabusTopicId || null,
        planItemId: target.planItemId || null,
      });
      setMessage(
        result.ok
          ? { kind: "ok", text: t("manual.saved", { minutes: durationMinutes }) }
          : { kind: "error", text: t(`errors.${result.reason}`) },
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("manual.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("manual.hint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("manual.startedAt")}</span>
          <Input
            type="datetime-local"
            required
            value={startedAt}
            onChange={(event) => setStartedAt(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">{t("manual.minutes")}</span>
          <Input
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={720}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
      </div>
      <TopicPicker subjects={subjects} planItems={planItems} value={target} onChange={setTarget} />
      <Button type="submit" disabled={pending}>
        {t("manual.submit")}
      </Button>
      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        {message ? (
          <p className={message.kind === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
