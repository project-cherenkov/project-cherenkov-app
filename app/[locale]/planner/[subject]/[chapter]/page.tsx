import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/site/coming-soon";

// Phase 2 route shape reserved per docs/phase-2-architecture.md — params
// aren't used yet since there's no data model behind this page until
// Phase 2 is actually built.
export default async function PlannerChapterPage() {
  const t = await getTranslations("phase2");
  return <ComingSoon title={t("plannerTitle")} />;
}
