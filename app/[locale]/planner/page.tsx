import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo-metadata";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { buildPlannerPageData } from "@/lib/plan-view";
import { planViewDeps } from "@/lib/plan-db";
import { PlanDashboard } from "@/components/planner/plan-dashboard";
import { PlannerOnboarding } from "@/components/planner/planner-onboarding";

// Phase 3 planner (OSN path): onboarding (settings -> self-ratings), then the
// adaptive plan. The older even-spread overview (components/planner/
// plan-overview.tsx) is no longer rendered here; it is kept, with its
// generator, as the deterministic fallback.
//
// middleware.ts already blocks unauthenticated requests to /planner/**; the
// null check is the defence-in-depth fallback.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return pageMetadata({ locale, path: "/planner", title: t("myPlan"), description: t("myPlan"), noindex: true });
}

export default async function PlannerPage() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  if (!user) redirect(`/${locale}/login`);

  const data = await buildPlannerPageData(planViewDeps, user.id, new Date(), locale);
  if (data.state === "plan") return <PlanDashboard data={data} />;
  return <PlannerOnboarding data={data} />;
}
