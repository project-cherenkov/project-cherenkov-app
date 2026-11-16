import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { isEmailConfigured } from "@/lib/email";
import { pageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.accountDeleted" });
  return pageMetadata({ locale, path: "/account-deleted", title: t("title"), description: t("title"), noindex: true });
}

// Where the emailed deletion link sends the browser once the account is gone.
// Self-serve deletion needs email, so without it this page does not exist.
export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isEmailConfigured()) notFound();
  const t = await getTranslations("account.accountDeleted");
  return (
    <div className="mx-auto max-w-sm px-4 py-12 sm:px-6">
      <h1 className="mb-3 text-2xl font-semibold text-foreground">{t("heading")}</h1>
      <p role="status" className="text-sm text-foreground/75">
        {t("body")}
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        {t("home")}
      </Link>
    </div>
  );
}
