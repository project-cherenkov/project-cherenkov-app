import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { homeVizPicks } from "@/lib/db/schema";
import { parseHomeVizPicks } from "@/lib/home-viz-picks";

export const dynamic = "force-dynamic";

// The home hero's chosen visualizations for the signed-in account. Signed-out
// visitors never reach this: their choice lives in the browser only.
//
//   GET     -> { picks: string[] | null }   null = no choice yet (use defaults)
//   PUT     -> body { picks: string[] }     replaces the choice
//   DELETE  -> clears the choice            (back to the defaults)

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const [row] = await db
      .select({ picks: homeVizPicks.picks })
      .from(homeVizPicks)
      .where(eq(homeVizPicks.userId, user.id))
      .limit(1);
    // Normalising also guards against a value that predates a rule change.
    return NextResponse.json({ picks: parseHomeVizPicks(row?.picks) });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const picks = parseHomeVizPicks((body as { picks?: unknown } | null)?.picks);
  if (!picks) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    await db
      .insert(homeVizPicks)
      .values({ userId: user.id, picks })
      .onConflictDoUpdate({
        target: homeVizPicks.userId,
        set: { picks, updatedAt: new Date() },
      });
    return NextResponse.json({ picks });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await db.delete(homeVizPicks).where(eq(homeVizPicks.userId, user.id));
    return NextResponse.json({ picks: null });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
