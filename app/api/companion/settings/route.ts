import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionSettings } from "@/lib/db/schema";
import { normalizeCompanionPrefs, parseCompanionPatch } from "@/lib/companion-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const [setting] = await db
      .select({
        name: companionSettings.name,
        enabled: companionSettings.enabled,
        size: companionSettings.size,
        rotation: companionSettings.rotation,
      })
      .from(companionSettings)
      .where(eq(companionSettings.userId, user.id))
      .limit(1);
    // No row yet means "all defaults"; normalising also guards against any
    // value that predates the CHECK constraints.
    return NextResponse.json(normalizeCompanionPrefs(setting));
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

// Partial update: send only the fields that changed. Unsent fields keep their
// stored value (or the column default if the account has no row yet).
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const patch = parseCompanionPatch(body);
  if (!patch) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const [saved] = await db
      .insert(companionSettings)
      .values({ userId: user.id, ...patch })
      .onConflictDoUpdate({
        target: companionSettings.userId,
        set: { ...patch, updatedAt: new Date() },
      })
      .returning({
        name: companionSettings.name,
        enabled: companionSettings.enabled,
        size: companionSettings.size,
        rotation: companionSettings.rotation,
      });
    return NextResponse.json(normalizeCompanionPrefs(saved));
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
