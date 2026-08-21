import { getLocale, getTranslations } from "next-intl/server";

import { getTeam } from "@/lib/team";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const team = await getTeam();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("title")}</h1>

      <p className="mt-6 text-slate-700">{t("philosophyPlaceholder")}</p>

      <h2 className="label-code mt-10">{t("teamHeading")}</h2>
      {team.length === 0 ? (
        // No entries in content/team/ yet — keep the existing placeholder
        // copy rather than rendering an empty list. This text is a COPY-001
        // concern (gated on GATHER-001), untouched here.
        <p className="mt-2 text-slate-700">{t("teamPlaceholder")}</p>
      ) : (
        <ul className="mt-4 grid gap-6 sm:grid-cols-2">
          {team.map((member) => {
            const bio = locale === "id" ? member.bioId : member.bioEn;
            return (
              <li key={member.name} className="flex gap-4">
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary Blob host, not worth a remotePatterns entry for three photos
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="h-16 w-16 flex-none rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex-none rounded-full bg-cherenkov-blue/20" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">{member.name}</p>
                  {bio && <p className="mt-1 text-sm text-slate-700">{bio}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
