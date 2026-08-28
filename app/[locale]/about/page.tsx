import { getLocale, getTranslations } from "next-intl/server";

import { getTeam } from "@/lib/team";

export default async function AboutPage() {
  const t = await getTranslations("about");
  const locale = await getLocale();
  const { members, professionalContact } = await getTeam();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="label-code">{t("eyebrow")}</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("title")}</h1>

      <p className="mt-6 text-slate-700">{t("philosophyPlaceholder")}</p>

      <h2 className="label-code mt-10">{t("teamHeading")}</h2>
      {members.length === 0 ? (
        // No entries in content/team/ yet — keep the existing placeholder
        // copy rather than rendering an empty list. This text is a COPY-001
        // concern (gated on GATHER-001), untouched here.
        <p className="mt-2 text-slate-700">{t("teamPlaceholder")}</p>
      ) : (
        <ul className="mt-4 grid gap-6 sm:grid-cols-2">
          {members.map((member) => {
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
                  {member.role && (
                    <p className="font-mono text-xs uppercase tracking-wide text-slate-500">
                      {member.role}
                    </p>
                  )}
                  {bio && <p className="mt-1 text-sm text-slate-700">{bio}</p>}
                  {member.personalContact && (
                    <a
                      href={`mailto:${member.personalContact}`}
                      className="mt-1.5 inline-block font-mono text-xs text-cherenkov-blue-pastel underline"
                    >
                      {member.personalContact}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="label-code mt-10">{t("repoHeading")}</h2>
      <p className="mt-2 text-slate-700">{t("repoBody")}</p>
      {/* Repo URL confirmed — see docs/deployment-readiness.md re: this repo being private. */}
      <a
        href="https://github.com/project-cherenkov/project-cherenkov-app"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-cherenkov-blue-pastel underline"
      >
        github.com/project-cherenkov/project-cherenkov-app
      </a>

      <h2 className="label-code mt-10">{t("contactHeading")}</h2>
      {professionalContact?.email ? (
        <div className="mt-2">
          {professionalContact.label ? (
            <p className="text-slate-700">{professionalContact.label}</p>
          ) : null}
          <a
            href={`mailto:${professionalContact.email}`}
            className="mt-1 inline-block text-cherenkov-blue-pastel underline"
          >
            {professionalContact.email}
          </a>
        </div>
      ) : (
        <p className="mt-2 text-slate-700">{t("contactPlaceholder")}</p>
      )}
    </div>
  );
}
