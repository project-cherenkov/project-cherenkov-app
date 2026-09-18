import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "@/keystatic.config";

// Reads the `team` singleton straight off disk (local storage), independent
// of Velite — team data isn't editorial content, so it doesn't belong in
// lib/content.ts's #content-backed helpers. content/team/ ships empty by
// default; nothing here invents names or bios.
const reader = createReader(process.cwd(), keystaticConfig);

export interface PersonalContactLink {
  label: string;
  href: string;
  value: string;
}

export interface TeamMember {
  name: string;
  role?: string;
  bioEn: string;
  bioId: string;
  photoUrl: string | null;
  personalContact?: string;
  personalContacts: PersonalContactLink[];
}

export interface ProfessionalContact {
  email: string;
  label?: string;
}

export interface TeamData {
  professionalContact?: ProfessionalContact;
  members: TeamMember[];
}

// BUGFIX (live report: a member's saved bio wasn't showing on /about):
// app/[locale]/about/page.tsx used to pick `locale === "id" ? bioId :
// bioEn` with no fallback. i18n/routing.ts's default locale is "id", and
// the Team singleton's Bio (Indonesian) field is separate from Bio
// (English) — every real member today only has bioEn filled in, so the
// default-locale page rendered an empty bio even though one was saved.
// Falls back to whichever language IS populated, so a member is never
// bio-less just because one of the two fields is blank.
export function resolveMemberBio(
  member: Pick<TeamMember, "bioEn" | "bioId">,
  locale: string,
): string {
  const primary = locale === "id" ? member.bioId : member.bioEn;
  return primary || member.bioEn || member.bioId || "";
}

export async function getTeam(): Promise<TeamData> {
  const team = await reader.singletons.team.read();
  if (!team) {
    return { members: [] };
  }

  const professionalContact =
    team.professionalContact && team.professionalContact.email
      ? {
          email: team.professionalContact.email,
          label: team.professionalContact.label || undefined,
        }
      : undefined;

  const members = (team.members || []).map((m) => {
    const explicitLinks = Array.isArray((m as { personalContacts?: ReadonlyArray<PersonalContactLink> }).personalContacts)
      ? ((m as { personalContacts?: ReadonlyArray<PersonalContactLink> }).personalContacts ?? []).filter(
          (link) => Boolean(link?.label && link?.href && link?.value),
        )
      : [];

    const fallbackContact = m.personalContact?.trim() ? m.personalContact.trim() : undefined;
    const mergedLinks = [
      ...(fallbackContact ? [{ label: "Email", href: `mailto:${fallbackContact}`, value: fallbackContact }] : []),
      ...explicitLinks,
    ];
    const seen = new Set<string>();
    const personalContacts = mergedLinks.filter((link) => {
      const dedupeKey = `${link.label.toLowerCase()}::${link.href.toLowerCase()}::${link.value.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });

    return {
      name: m.name,
      role: m.role || undefined,
      bioEn: m.bioEn || "",
      bioId: m.bioId || "",
      photoUrl: m.photoUrl || null,
      personalContact: fallbackContact,
      personalContacts,
    };
  });

  return {
    professionalContact,
    members,
  };
}
