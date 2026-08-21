import { createReader } from "@keystatic/core/reader";
import keystaticConfig from "@/keystatic.config";

// Reads the `team` singleton straight off disk (local storage), independent
// of Velite — team data isn't editorial content, so it doesn't belong in
// lib/content.ts's #content-backed helpers. content/team/ ships empty by
// default; nothing here invents names or bios.
const reader = createReader(process.cwd(), keystaticConfig);

export interface TeamMember {
  name: string;
  bioEn: string;
  bioId: string;
  photoUrl: string | null;
}

export async function getTeam(): Promise<TeamMember[]> {
  const team = await reader.singletons.team.read();
  if (!team) return [];
  return team.members.map((m) => ({
    name: m.name,
    bioEn: m.bioEn,
    bioId: m.bioId,
    photoUrl: m.photoUrl || null,
  }));
}
