import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "@/keystatic.config";

// Reads the `team` singleton straight off disk (local storage), independent
// of Velite — team data isn't editorial content, so it doesn't belong in
// lib/content.ts's #content-backed helpers. content/team/ ships empty by
// default; nothing here invents names or bios.
const reader = createReader(process.cwd(), keystaticConfig);

export interface TeamMember {
  name: string;
  role?: string;
  bioEn: string;
  bioId: string;
  photoUrl: string | null;
  personalContact?: string;
}

export interface ProfessionalContact {
  email: string;
  label?: string;
}

export interface TeamData {
  professionalContact?: ProfessionalContact;
  members: TeamMember[];
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

  const members = (team.members || []).map((m) => ({
    name: m.name,
    role: m.role || undefined,
    bioEn: m.bioEn || "",
    bioId: m.bioId || "",
    photoUrl: m.photoUrl || null,
    personalContact: m.personalContact || undefined,
  }));

  return {
    professionalContact,
    members,
  };
}
