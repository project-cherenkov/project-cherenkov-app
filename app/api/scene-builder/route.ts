import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import { createGithubClient } from "@/lib/scene-builder-github";
import { GITHUB_TOKEN_COOKIE, readCookie, readGithubToken } from "@/lib/scene-builder-oauth";
import { isGithubModeConfigured, writeSceneConfig } from "@/lib/scene-builder-write";

interface ScenePostBody {
  subject: string;
  slug: string;
  vizConfig: unknown;
}

function parseBody(value: unknown): ScenePostBody | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.subject !== "string" || typeof record.slug !== "string") return null;
  if (!("vizConfig" in record)) return null;
  return { subject: record.subject, slug: record.slug, vizConfig: record.vizConfig };
}

export async function POST(request: Request) {
  // SEC-001-style per-request session check (same fail-closed
  // getCurrentUser() as app/api/team-photo/route.ts), independent of
  // middleware.ts's isAdminSurfaceEnabled() env-level gate — checked
  // before touching the request body or the filesystem/GitHub.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json(
      { error: "subject, slug, and vizConfig are all required." },
      { status: 400 },
    );
  }

  // GitHub mode (Decision B): the contributor must have already completed
  // the /api/scene-builder/github-oauth/start handshake, which leaves a
  // signed, short-lived token cookie behind. No such step exists (or is
  // needed) in local mode.
  let githubClient;
  if (isGithubModeConfigured()) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = readGithubToken(readCookie(cookieHeader, GITHUB_TOKEN_COOKIE));
    if (!token) {
      return NextResponse.json(
        {
          error:
            "GitHub authorization required. Visit /api/scene-builder/github-oauth/start, then try saving again.",
        },
        { status: 401 },
      );
    }
    githubClient = createGithubClient(token);
  }

  const result = await writeSceneConfig(body, { githubClient });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
