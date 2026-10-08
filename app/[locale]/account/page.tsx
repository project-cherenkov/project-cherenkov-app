import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/lib/seo-metadata";
import { redirect } from "next/navigation";
import NextLink from "next/link";
import { getCurrentUser } from "@/lib/auth-guard";
import { getAccountDetails } from "@/lib/account";
import { ROLE_LABELS } from "@/lib/account-roles";
import { Link } from "@/i18n/routing";
import { SignOutButton } from "@/components/account/sign-out-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return pageMetadata({ locale, path: "/account", title: t("title"), description: t("title"), noindex: true });
}

// middleware.ts already redirects signed-out visitors to /login; the null
// checks are the defence-in-depth fallback, same as the planner pages.
export default async function AccountPage() {
  const [t, locale, current] = await Promise.all([
    getTranslations("account"),
    getLocale(),
    getCurrentUser(),
  ]);
  if (!current) redirect(`/${locale}/login`);
  const details = await getAccountDetails(current.id);
  if (!details) redirect(`/${locale}/login`);

  const providerLabel = (id: string) =>
    id === "credential" ? t("providerPassword") : id === "google" ? "Google" : id;
  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(details.createdAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>

      <dl className="mt-8 divide-y divide-border rounded-lg border border-border bg-card">
        <Row label={t("username")} value={details.name} />
        <Row label={t("email")} value={details.email} />
        <Row
          label={t("role")}
          value={
            <span>
              <span className="font-mono font-semibold">{ROLE_LABELS[details.role]}</span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                {t(details.hasEditAccess ? "roleEditorHint" : "roleMemberHint")}
              </span>
            </span>
          }
        />
        <Row label={t("signInMethods")} value={details.providers.map(providerLabel).join(", ") || "—"} />
        <Row label={t("memberSince")} value={joined} />
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/planner"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t("goToPlan")}
        </Link>
        {details.hasEditAccess ? (
          <NextLink
            href="/keystatic"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t("openEditor")}
          </NextLink>
        ) : null}
        <SignOutButton />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-mono text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </div>
  );
}
