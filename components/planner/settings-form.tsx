"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { savePlannerSettings } from "@/lib/planner-settings-actions";
import { OSN_STAGES, SCHEDULE_YEARS, STAGES, getStageWindow } from "@/lib/osn-stages";
import { SUBJECTS } from "@/lib/subjects";
import { MAX_HOURS_PER_WEEK } from "@/lib/planner-vocab";
import type { PlannerSettings, SettingsField } from "@/lib/planner-settings";

export interface SettingsFormProps {
  initial: PlannerSettings | null;
  // Called after a successful save. `subjectChanged` is true when the student
  // switched subject (the old plan no longer applies).
  onSaved: (result: { subjectChanged: boolean }) => void;
  submitLabel?: string;
}

const YEARS = Object.keys(SCHEDULE_YEARS).map(Number).sort((a, b) => a - b);

function browserZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function SettingsForm({ initial, onSaved, submitLabel }: SettingsFormProps) {
  const t = useTranslations("phase3.settings");
  const locale = useLocale() as "en" | "id";
  const [subject, setSubject] = useState<string>(initial?.subject ?? SUBJECTS[0]);
  const [stage, setStage] = useState<string>(initial?.stage ?? OSN_STAGES[0]);
  const [examYear, setExamYear] = useState<number>(initial?.examYear ?? YEARS[0]!);
  const [hours, setHours] = useState<string>(String(initial?.hoursPerWeek ?? 6));
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = SCHEDULE_YEARS[examYear];
  const windowInfo = (OSN_STAGES as readonly string[]).includes(stage)
    ? getStageWindow(stage as (typeof OSN_STAGES)[number], examYear)
    : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setGeneralError(null);
    startTransition(async () => {
      const result = await savePlannerSettings({
        subject,
        stage,
        examYear,
        hoursPerWeek: Number(hours),
        timezone: browserZone() ?? initial?.timezone,
      });
      if (result.ok) {
        onSaved({ subjectChanged: result.subjectChanged });
      } else if ("unauthenticated" in result) {
        setGeneralError(t("errorUnauthenticated"));
      } else {
        setErrors(result.errors);
      }
    });
  }

  const field = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        {t("subject")}
        <select className={field} value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{t(`subjects.${s}`)}</option>
          ))}
        </select>
        {errors.subject ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.subject}</span> : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("stage")}
        <select className={field} value={stage} onChange={(e) => setStage(e.target.value)}>
          {OSN_STAGES.map((s) => (
            <option key={s} value={s}>{STAGES[s].label[locale]}</option>
          ))}
        </select>
        {errors.stage ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.stage}</span> : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("year")}
        <select className={field} value={examYear} onChange={(e) => setExamYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {errors.examYear ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.examYear}</span> : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("hours", { max: MAX_HOURS_PER_WEEK })}
        <input
          className={field}
          type="number"
          inputMode="decimal"
          min={0.5}
          max={MAX_HOURS_PER_WEEK}
          step={0.5}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
        />
        {errors.hoursPerWeek ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{errors.hoursPerWeek}</span> : null}
      </label>

      <div className="sm:col-span-2 space-y-2">
        {windowInfo ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t("examStarts", { date: windowInfo.start })}{" "}
            {status === "projected" ? <strong>{t("projectedNote")}</strong> : null}
          </p>
        ) : null}
        {errors.timezone ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errors.timezone}</p> : null}
        {generalError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{generalError}</p> : null}
        <Button type="submit" disabled={pending}>{submitLabel ?? t("save")}</Button>
      </div>
    </form>
  );
}
