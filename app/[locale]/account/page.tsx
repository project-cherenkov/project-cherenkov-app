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
import { AuthPage } from "@/components/auth/auth-page";
import { isEmailConfigured } from "@/lib/email";
import { editorsMustVerifyEmail, isAdminEmail } from "@/lib/admin-guard";
import { DeleteAccount } from "@/components/account/delete-account";
import { EmailVerification } from "@/components/account/email-verification";
import { PasswordSettings } from "@/components/account/password-settings";
import { CompanionPreferences } from "@/components/study/companion-preferences";
import { CompanionData } from "@/components/study/companion-data";
import { DEFAULT_COMPANION_PREFS, normalizeCompanionPrefs } from "@/lib/companion-settings";
import { db } from "@/lib/db";
import { companionSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return pageMetadata({ locale, path: "/account", title: t("title"), description: t("title"), noindex: true });
}

export default async function AccountPage() {
  const [t, tc, locale, current] = await Promise.all([
    getTranslations("account"),
    getTranslations("companion"),
    getLocale(),
    getCurrentUser(),
  ]);
  if (!current) {
    return (
      <AuthPage
        defaultTab="login"
        googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
        resetEnabled={isEmailConfigured()}
      />
    );
  }
  const details = await getAccountDetails(current.id);
  if (!details) redirect(`/${locale}/login`);
  let companionPrefs = DEFAULT_COMPANION_PREFS;
  try {
    const [setting] = await db
      .select({
        name: companionSettings.name,
        enabled: companionSettings.enabled,
        aiEnabled: companionSettings.aiEnabled,
        aiAcknowledged: companionSettings.aiAcknowledged,
        updatesEnabled: companionSettings.updatesEnabled,
        size: companionSettings.size,
        rotation: companionSettings.rotation,
        style: companionSettings.style,
      })
      .from(companionSettings)
      .where(eq(companionSettings.userId, current.id))
      .limit(1);
    companionPrefs = normalizeCompanionPrefs(setting);
  } catch {
    // Account details remain available if the optional companion preferences
    // cannot be read temporarily.
  }

  const providerLabel = (id: string) =>
    id === "credential" ? t("providerPassword") : id === "google" ? "Google" : id;
  const emailEnabled = isEmailConfigured();
  // An address on the editor list that is not verified yet: explain why there is
  // no edit access, instead of leaving the editor guessing.
  const needsVerifyForEdit = !details.hasEditAccess && !details.emailVerified && editorsMustVerifyEmail() && isAdminEmail(details.email);
  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(details.createdAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="label-code" aria-hidden="true">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">{t("title")}</h1>

      <section className="mt-8" aria-labelledby="settings-account">
        <h2 id="settings-account" className="heading-section">{tc("sectionAccount")}</h2>
        <dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
          <Row label={t("username")} value={details.name} />
          <Row
            label={t("email")}
            value={
              <span>
                {details.email}
                {emailEnabled ? <EmailVerification email={details.email} verified={details.emailVerified} /> : null}
              </span>
            }
          />
          <Row
            label={t("role")}
            value={
              <span>
                <span className="font-mono font-semibold">{ROLE_LABELS[details.role]}</span>
                <span className="mt-1 block text-sm text-foreground/75">
                  {t(details.hasEditAccess ? "roleEditorHint" : needsVerifyForEdit ? "roleVerifyHint" : "roleMemberHint")}
                </span>
              </span>
            }
          />
          <Row label={t("signInMethods")} value={details.providers.map(providerLabel).join(", ") || "—"} />
          <Row label={t("memberSince")} value={joined} />
        </dl>

      <PasswordSettings
        email={details.email}
        hasPassword={details.providers.includes("credential")}
        resetEnabled={isEmailConfigured()}
      />

      {emailEnabled ? (
        <DeleteAccount email={details.email} hasPassword={details.providers.includes("credential")} />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/planner"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          {t("goToPlan")}
        </Link>
        {details.hasEditAccess ? (
          <NextLink
            href="/keystatic"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("openEditor")}
          </NextLink>
        ) : null}
        <SignOutButton />
      </div>
      </section>

      <section className="mt-12" aria-labelledby="settings-neutrino">
        <h2 id="settings-neutrino" className="heading-section">{tc("sectionNeutrino")}</h2>
        <CompanionPreferences signedIn initial={companionPrefs} />
      </section>

      <section className="mt-12" aria-labelledby="settings-data">
        <h2 id="settings-data" className="heading-section mb-4">{tc("sectionData")}</h2>
        <CompanionData signedIn />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-foreground">{value}</dd>
    </div>
  );
}
