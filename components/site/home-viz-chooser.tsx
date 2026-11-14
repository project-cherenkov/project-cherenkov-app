"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { HomeVizCandidate } from "@/lib/home-viz-candidates";
import { MAX_HOME_VIZ_PICKS, MIN_HOME_VIZ_PICKS } from "@/lib/home-viz-picks";

// "Change": choose which one to three visualizations the hero shows. Not
// grouped or filtered by subject, on purpose: all three may be astronomy. The
// order of the choice is the order of the list, and the first is shown first.
export function HomeVizChooser({
  candidates,
  picks,
  hasSavedChoice,
  subjectLabel,
  onSave,
  onUseDefaults,
}: {
  candidates: HomeVizCandidate[];
  /** What the hero shows now. */
  picks: string[];
  hasSavedChoice: boolean;
  subjectLabel: (subject: HomeVizCandidate["subject"]) => string;
  onSave: (picks: string[]) => void;
  onUseDefaults: () => void;
}) {
  const t = useTranslations("home.visualizations.picks");
  const locale = useLocale();
  const other = (lang: string) => (lang === locale ? undefined : lang);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(picks);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(picks);
    setOpen(next);
  }

  function toggle(key: string) {
    setDraft((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return current.length >= MAX_HOME_VIZ_PICKS ? current : [...current, key];
    });
  }

  const full = draft.length >= MAX_HOME_VIZ_PICKS;
  const valid = draft.length >= MIN_HOME_VIZ_PICKS;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-9">
          {t("change")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogTitle>{t("chooseTitle")}</DialogTitle>
        <DialogDescription>{t("chooseHelp")}</DialogDescription>

        <fieldset className="mt-4 min-w-0">
          <legend className="sr-only">{t("chooseTitle")}</legend>
          <ul className="flex flex-col gap-2">
            {candidates.map((candidate) => {
              const checked = draft.includes(candidate.key);
              const disabled = !checked && full;
              return (
                <li key={candidate.key}>
                  <label
                    className={[
                      "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3",
                      checked ? "border-brand bg-muted" : "border-border",
                      disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(candidate.key)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--brand))]"
                    />
                    <span className="min-w-0">
                      <span lang={other(candidate.titleLang)} className="block text-sm font-semibold">
                        {candidate.title}
                      </span>
                      <span className="label-mono block">{subjectLabel(candidate.subject)}</span>
                      {candidate.description && (
                        <span
                          lang={other(candidate.descriptionLang)}
                          className="mt-1 line-clamp-2 block text-xs text-muted-foreground"
                        >
                          {candidate.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t("count", { count: draft.length, max: MAX_HOME_VIZ_PICKS })}
          {full ? ` ${t("atLimit")}` : ""}
          {!valid ? ` ${t("needOne")}` : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasSavedChoice}
            onClick={() => {
              onUseDefaults();
              setOpen(false);
            }}
          >
            {t("useDefaults")}
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={!valid}
              onClick={() => {
                onSave(draft);
                setOpen(false);
              }}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
