import { getTranslations, getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getUserPlan } from "@/lib/planner";
import {
  PlanOverview,
  type PlanOverviewItem,
} from "@/components/planner/plan-overview";
import { GeneratePlanForm } from "@/components/planner/generate-plan-form";

// PLANNER-003. middleware.ts's planner-auth branch already blocks
// unauthenticated requests to this route — the null check below is a
// defensive fallback only, for the edge case of a session expiring between
// middleware and render (spec §9 defense-in-depth).
export default async function PlannerPage() {
  const [t, locale, user] = await Promise.all([
    getTranslations("phase2.planner"),
    getLocale(),
    getCurrentUser(),
  ]);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const plan = await getUserPlan(user.id);

  const items: PlanOverviewItem[] = plan.items.map((item) => ({
    topicId: item.topic.id,
    subject: item.topic.subject,
    chapter: item.topic.chapter,
    title: item.topic.title,
    status: item.status,
    scheduledFor: item.scheduledFor,
  }));

  return (
    <PlanOverview
      labels={{
        overviewHeading: t("overviewHeading"),
        generatePlanPrompt: t("generatePlanPrompt"),
        generatePlanBody: t("generatePlanBody"),
        statusDone: t("statusDone"),
        statusInProgress: t("statusInProgress"),
        statusNotStarted: t("statusNotStarted"),
        scheduledForPrefix: t("scheduledForPrefix"),
      }}
      hasPlan={plan.hasPlan}
      items={items}
      locale={locale}
      generatePlanForm={
        <GeneratePlanForm
          labels={{
            examDateLabel: t("examDateLabel"),
            generateButton: t("generateButton"),
            regenerateButton: t("regenerateButton"),
          }}
          hasPlan={plan.hasPlan}
          defaultExamDate={plan.targetExamDate}
        />
      }
    />
  );
}
