"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  COMPANION_NAME_MAX,
  COMPANION_ROTATIONS,
  COMPANION_SIZES,
  COMPANION_STYLES,
  DEFAULT_COMPANION_PREFS,
  DEFAULT_DRIFT_SPEED,
  MOTION_SPEED_MAX,
  MOTION_SPEED_MIN,
  MOTION_SPEED_STEP,
  type CompanionPrefs,
} from "@/lib/companion-settings";
import { useCompanionPrefs, type PrefsSaveResult } from "@/components/study/use-companion-prefs";
import { OwnKeySettings } from "@/components/study/own-key-settings";
import { Slider } from "@/components/ui/slider";

type Status = "idle" | "saving" | PrefsSaveResult | "nameSaved" | "nameError" | "positionReset" | "panelSizeReset" | "resetAllDone";

const optionLabel =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-background px-3 py-2 text-center text-sm font-medium text-foreground " +
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
  onResetPanelSize,
  onResetAll,
  onHideUntilReload,
}: {
  signedIn: boolean;
  initial?: CompanionPrefs;
  variant?: "card" | "compact";
  onResetPosition?: () => void;
  onResetPanelSize?: () => void;
  onResetAll?: () => void;
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

  async function resetAll() {
    setStatus("saving");
    const result = await update(DEFAULT_COMPANION_PREFS);
    if (result === "error") {
      setStatus("error");
      return;
    }
    onResetAll?.();
    setStatus("resetAllDone");
  }

  const message =
    status === "nameSaved" ? t("nameSaved")
    : status === "nameError" ? t("nameError")
    : status === "saved" ? t("prefsSaved")
    : status === "local" ? t("prefsLocal")
    : status === "error" ? t("prefsError")
    : status === "positionReset" ? t("positionReset")
    : status === "panelSizeReset" ? t("panelSizeReset")
    : status === "resetAllDone" ? t("resetAllDone")
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
                className="h-11 w-full rounded-md border border-border-strong bg-background px-3"
              />
            </label>
            <button
              type="submit"
              disabled={status === "saving" || !name.trim() || name.trim() === prefs.name}
              className="mt-auto h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
          {/* This account setting must stay in this shared component so it is
              always available in both Account and Neutrino settings. */}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              checked={prefs.updatesEnabled}
              onChange={(event) => void apply({ updatesEnabled: event.target.checked })}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              <span className="block font-medium">{t("updatesLabel")}</span>
              <span className="block text-xs text-muted-foreground">{t("updatesHelp")}</span>
            </span>
          </label>
        </>
      ) : (
        <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{t("accountOnly")}</p>
      )}

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={prefs.aiEnabled}
          onChange={(event) => void apply({ aiEnabled: event.target.checked })}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          <span className="block font-medium">{t("aiLabel")}</span>
          <span className="block text-xs text-muted-foreground">{t("aiHelp")}</span>
        </span>
      </label>

      {signedIn && prefs.aiEnabled ? <OwnKeySettings /> : null}

      <RadioGroup
        legend={t("styleLabel")}
        name={`${fieldId}-style`}
        value={prefs.style}
        onChange={(style) => void apply({ style })}
        options={COMPANION_STYLES.map((style) => ({ value: style, label: t(`styles.${style}.label`), help: t(`styles.${style}.help`) }))}
      />

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

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={prefs.ambientMotion}
          onChange={(event) => void apply({ ambientMotion: event.target.checked })}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          <span className="block font-medium">{t("ambientMotionLabel")}</span>
          <span className="block text-xs text-muted-foreground">{t("ambientMotionHelp")}</span>
        </span>
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span id={`${fieldId}-drift-speed-label`} className="text-sm font-medium">{t("driftSpeedLabel")}</span>
          <span className="flex items-center gap-2">
            <output className="text-sm tabular-nums text-muted-foreground">{((prefs.driftSpeed ?? DEFAULT_DRIFT_SPEED) / 100).toFixed(1)}×</output>
            <button
              type="button"
              onClick={() => void apply({ driftSpeed: DEFAULT_DRIFT_SPEED })}
              disabled={(prefs.driftSpeed ?? DEFAULT_DRIFT_SPEED) === DEFAULT_DRIFT_SPEED}
              aria-label={`${t("resetSpeed")} ${t("driftSpeedLabel")}`}
              className="min-h-8 rounded-md px-2 text-xs text-cherenkov-blue-700 underline underline-offset-2 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline dark:text-cherenkov-blue-pastel"
            >
              {t("resetSpeed")}
            </button>
          </span>
        </div>
        <Slider
          aria-labelledby={`${fieldId}-drift-speed-label`}
          value={[prefs.driftSpeed ?? DEFAULT_DRIFT_SPEED]}
          min={MOTION_SPEED_MIN}
          max={MOTION_SPEED_MAX}
          step={MOTION_SPEED_STEP}
          valueText={`${((prefs.driftSpeed ?? DEFAULT_DRIFT_SPEED) / 100).toFixed(1)}×`}
          onValueChange={(values) => { if (values[0] !== undefined) void apply({ driftSpeed: values[0] }); }}
        />
        <div className="flex justify-between text-xs text-muted-foreground"><span>{t("speedSlow")}</span><span>{t("speedFast")}</span></div>
        <p className="text-xs text-muted-foreground">{t("driftSpeedHelp")}</p>
      </div>

      {onResetPosition || onResetPanelSize || onResetAll || onHideUntilReload ? (
        <div className="flex flex-wrap gap-2">
          {onResetAll ? (
            <button
              type="button"
              onClick={() => void resetAll()}
              disabled={status === "saving"}
              className="min-h-11 rounded-md border border-cherenkov-blue-700 px-4 text-sm font-medium text-cherenkov-blue-700 hover:bg-muted disabled:opacity-50 dark:border-cherenkov-blue-pastel dark:text-cherenkov-blue-pastel"
            >
              {t("resetAll")}
            </button>
          ) : null}
          {onResetPosition ? (
            <button
              type="button"
              onClick={() => { onResetPosition(); setStatus("positionReset"); }}
              className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted"
            >
              {t("resetPosition")}
            </button>
          ) : null}
          {onResetPanelSize ? (
            <button
              type="button"
              onClick={() => { onResetPanelSize(); setStatus("panelSizeReset"); }}
              className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted"
            >
              {t("resetPanelSize")}
            </button>
          ) : null}
          {onHideUntilReload ? (
            <button
              type="button"
              onClick={onHideUntilReload}
              className="min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-muted"
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
      <h3 className="font-semibold text-foreground">{t("settingsTitle")}</h3>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{t("settingsDescription")}</p>
      {body}
    </section>
  );
}
