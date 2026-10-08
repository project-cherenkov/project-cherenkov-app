import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { buildPageMetadata, type PageMetaInput } from "@/lib/seo";

// Async convenience wrapper: every page's generateMetadata needs the
// translated site name, so fetch it once here rather than in each page.
export async function pageMetadata(
  input: Omit<PageMetaInput, "siteName"> & { siteName?: string },
): Promise<Metadata> {
  const siteName =
    input.siteName ?? (await getTranslations({ locale: input.locale, namespace: "site" }))("name");
  return buildPageMetadata({ ...input, siteName });
}
