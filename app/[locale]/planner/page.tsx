import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/site/coming-soon";

export default async function PlannerPage() {
  const t = await getTranslations("phase2");
  return <ComingSoon title={t("plannerTitle")} />;
}
