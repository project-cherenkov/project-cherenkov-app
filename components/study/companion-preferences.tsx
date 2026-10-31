"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  COMPANION_NAME_MAX,
  COMPANION_ROTATIONS,
  COMPANION_SIZES,
  type CompanionPrefs,
} from "@/lib/companion-settings";
import { useCompanionPrefs, type PrefsSaveResult } from "@/components/study/use-companion-prefs";

type Status = "idle" | "saving" | PrefsSaveResult | "nameSaved" | "nameError" | "positionReset";

const optionLabel =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-center text-sm font-medium text-foreground " +
  "peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:bg-muted/60";

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string; help?: string }>;
  onChange: (value: T) => void;
}) {
  const helpId = useId();
  const selected = options.find((option) => option.value === value);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className={`grid gap-2 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-describedby={selected?.help ? helpId : undefined}>
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className={optionLabel}>{option.label}</span>
          </label>
        ))}
      </div>
      {selected?.help ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {selected.help}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The companion's settings: name, show/hide, size and rotation style. Rendered
 * both on the account page (`card`) and inside the companion's own Settings
 * tab (`compact`). Both write through the same hook, so changing one updates
 * the other and the mascot immediately.
 */
export function CompanionPreferences({
  signedIn,
  initial,
  variant = "card",
  onResetPosition,
  onHideUntilReload,
}: {
  signedIn: boolean;
  initial?: CompanionPrefs;
  variant?: "card" | "compact";
  onResetPosition?: () => void;
  onHideUntilReload?: () => void;
}) {
  const t = useTranslations("companion");
  const { prefs, update } = useCompanionPrefs(signedIn, initial);
  const [name, setName] = useState(prefs.name);
  const [status, setStatus] = useState<Status>("idle");
  const fieldId = useId();

  // Follow the name when it changes elsewhere (loaded from the account, or
  // edited in the other copy of this form).
  useEffect(() => setName(prefs.name), [prefs.name]);

  async function apply(patch: Parameters<typeof update>[0]) {
    setStatus("saving");
    setStatus(await update(patch));
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const result = await update({ name });
    setStatus(result === "saved" ? "nameSaved" : "nameError");
  }

  const message =
    status === "nameSaved" ? t("nameSaved")
    : status === "nameError" ? t("nameError")
    : status === "saved" ? t("prefsSaved")
    : status === "local" ? t("prefsLocal")
    : status === "error" ? t("prefsError")
    : status === "positionReset" ? t("positionReset")
    : "";

  const body = (
    <div className="space-y-5">
      {signedIn ? (
        <>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={saveName}>
            <label className="flex-1 space-y-1 text-sm" htmlFor={`${fieldId}-name`}>
              <span className="font-medium">{t("nameLabel")}</span>
              <input
                id={`${fieldId}-name`}
                value={name}
                onChange={(event) => { setName(event.target.value); setStatus("idle"); }}
                maxLength={COMPANION_NAME_MAX}
                required
                className="h-11 w-full rounded-md border border-border bg-background px-3"
              />
            </label>
            <button
              type="submit"
              disabled={status === "saving" || !name.trim() || name.trim() === prefs.name}
              className="mt-auto h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {status === "saving" ? t("saving") : t("saveName")}
            </button>
          </form>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={prefs.enabled}
              onChange={(event) => void apply({ enabled: event.target.checked })}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              <span className="block font-medium">{t("activeLabel")}</span>
              <span className="block text-xs text-muted-foreground">{t("activeHelp")}</span>
            </span>
          </label>
        </>
      ) : (
        <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{t("accountOnly")}</p>
      )}

      <RadioGroup
        legend={t("sizeLabel")}
        name={`${fieldId}-size`}
        value={prefs.size}
        onChange={(size) => void apply({ size })}
        options={COMPANION_SIZES.map((size) => ({ value: size, label: t(`sizes.${size}`) }))}
      />

      <RadioGroup
        legend={t("rotationLabel")}
        name={`${fieldId}-rotation`}
        value={prefs.rotation}
        onChange={(rotation) => void apply({ rotation })}
        options={COMPANION_ROTATIONS.map((rotation) => ({
          value: rotation,
          label: t(`rotations.${rotation}.label`),
          help: t(`rotations.${rotation}.help`),
        }))}
      />

      {onResetPosition || onHideUntilReload ? (
        <div className="flex flex-wrap gap-2">
          {onResetPosition ? (
            <button
              type="button"
              onClick={() => { onResetPosition(); setStatus("positionReset"); }}
              className="min-h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              {t("resetPosition")}
            </button>
          ) : null}
          {onHideUntilReload ? (
            <button
              type="button"
              onClick={onHideUntilReload}
              className="min-h-11 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              {t("hideNow")}
            </button>
          ) : null}
        </div>
      ) : null}

      <p role="status" className="min-h-5 text-sm text-muted-foreground">{message}</p>
    </div>
  );

  if (variant === "compact") return body;
  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold text-foreground">{t("settingsTitle")}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("settingsDescription")}</p>
      {body}
    </section>
  );
}
