"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { SettingsForm } from "./settings-form";
import { SelfRatingForm } from "./self-rating-form";
import type { PlannerPageData } from "@/lib/plan-view";

type Data = Exclude<PlannerPageData, { state: "plan" }>;

// Two-step onboarding: (1) what are you preparing for, (2) rate each topic.
// Submitting step 2 saves the ratings and generates the plan.
export function PlannerOnboarding({ data }: { data: Data }) {
  const t = useTranslations("phase3.onboarding");
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="label-code">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
      </header>

      {data.state === "needs_settings" ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{t("step1")}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("step1Body")}</p>
          <SettingsForm initial={null} submitLabel={t("continue")} onSaved={() => router.refresh()} />
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">{t("changeSettings")}</summary>
              <div className="px-4 pb-4">
                <SettingsForm initial={data.settings} submitLabel={t("saveSettings")} onSaved={() => router.refresh()} />
              </div>
            </details>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("step2")}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t("step2Body")}</p>
            {data.topicsMissing ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t("topicsMissing")}</p>
            ) : (
              <SelfRatingForm topics={data.topics} submitLabel={t("generate")} onDone={() => router.refresh()} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
