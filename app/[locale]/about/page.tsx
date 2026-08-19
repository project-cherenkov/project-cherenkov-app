import { getTranslations } from "next-intl/server";

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("title")}</h1>

      <p className="mt-6 text-slate-700">{t("philosophyPlaceholder")}</p>

      <h2 className="label-code mt-10">{t("teamHeading")}</h2>
      <p className="mt-2 text-slate-700">{t("teamPlaceholder")}</p>

      <h2 className="label-code mt-10">{t("repoHeading")}</h2>
      <p className="mt-2 text-slate-700">{t("repoBody")}</p>
      {/* PLACEHOLDER: repo URL — Section 12 open question, not provided yet */}
      <a
        href="https://github.com/PLACEHOLDER-org/PLACEHOLDER-repo"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-cherenkov-blue-pastel underline"
      >
        github.com/PLACEHOLDER-org/PLACEHOLDER-repo
      </a>
    </div>
  );
}
