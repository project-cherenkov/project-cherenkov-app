"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export function CompanionNameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("companion");
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/companion/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("save failed");
      const data = await response.json();
      setName(data.name);
      window.dispatchEvent(new CustomEvent("neutrino-name-changed", { detail: data.name }));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold text-foreground">{t("settingsTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("settingsDescription")}</p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={save}>
        <label className="flex-1 space-y-1 text-sm">
          <span className="font-medium">{t("nameLabel")}</span>
          <input
            value={name}
            onChange={(event) => { setName(event.target.value); setStatus("idle"); }}
            maxLength={32}
            required
            className="h-10 w-full rounded-md border border-border bg-background px-3"
          />
        </label>
        <button type="submit" disabled={status === "saving" || !name.trim()} className="mt-auto h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
          {status === "saving" ? t("saving") : t("saveName")}
        </button>
      </form>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted-foreground">
        {status === "saved" ? t("nameSaved") : status === "error" ? t("nameError") : ""}
      </p>
    </section>
  );
}
