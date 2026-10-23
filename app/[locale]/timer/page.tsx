import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { PlannerSubnav } from "@/components/planner/planner-subnav";
import { ManualSessionForm } from "@/components/study/manual-session-form";
import { StudyTimer } from "@/components/study/study-timer";
import type { PickerPlanItem } from "@/components/study/topic-picker";
import { getCurrentUser } from "@/lib/auth-guard";
import { todayInTimeZone } from "@/lib/osn-stages";
import { planViewDeps } from "@/lib/plan-db";
import { DEFAULT_PLANNER_TIMEZONE } from "@/lib/planner-vocab";
import { pageMetadata } from "@/lib/seo-metadata";
import { loadOpenPlanItems } from "@/lib/study-session-db";
import { buildPickerSubjects } from "@/lib/syllabus-picker";
import { getTopicLocation, localize } from "@/lib/syllabus";

// Public: anyone can use the timer. Signed-in students additionally get their
// finished sessions saved (and can attach them to a plan item). It reads the
// session cookie, so it cannot be static.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "timer" });
  return pageMetadata({ locale, path: "/timer", title: t("title"), description: t("intro") });
}

export default async function TimerPage() {
  const [locale, user, t, ts, tp] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getTranslations("timer"),
    getTranslations("syllabus.subjects"),
    getTranslations("phase3.plan.kind"),
  ]);
  const subjects = buildPickerSubjects(locale, (subject) => ts(subject));

  let planItems: PickerPlanItem[] = [];
  if (user) {
    try {
      const settings = await planViewDeps.getSettings(user.id);
      const today = todayInTimeZone(new Date(), settings?.timezone ?? DEFAULT_PLANNER_TIMEZONE);
      const open = await loadOpenPlanItems(user.id, today);
      planItems = open.flatMap((item) => {
        const located = getTopicLocation(item.subject, item.syllabusTopicId);
        if (!located) return [];
        return [
          {
            id: item.id,
            label: `${tp(item.kind as never)} · ${localize(located.topic.name, locale)}`,
            subject: item.subject,
            syllabusTopicId: item.syllabusTopicId,
            minutes: item.minutes,
          },
        ];
      });
    } catch {
      // The timer works without the plan; a database hiccup only means the
      // plan-item picker is empty.
    }
  }

  return (
    <>
      {user ? <PlannerSubnav /> : null}
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
        <header>
          <p className="label-code">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{t("intro")}</p>
        </header>
        <StudyTimer signedIn={Boolean(user)} subjects={subjects} planItems={planItems} />
        {user ? <ManualSessionForm subjects={subjects} planItems={planItems} /> : null}
      </div>
    </>
  );
}
