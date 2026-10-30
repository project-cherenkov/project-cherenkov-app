import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { companionSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const [setting] = await db
      .select({ name: companionSettings.name })
      .from(companionSettings)
      .where(eq(companionSettings.userId, user.id))
      .limit(1);
    return NextResponse.json({ name: setting?.name ?? "Neutrino" });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const name = typeof body === "object" && body !== null ? (body as { name?: unknown }).name : null;
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 32) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  try {
    const normalized = name.trim();
    await db
      .insert(companionSettings)
      .values({ userId: user.id, name: normalized })
      .onConflictDoUpdate({
        target: companionSettings.userId,
        set: { name: normalized, updatedAt: new Date() },
      });
    return NextResponse.json({ name: normalized });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
