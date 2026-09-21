import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import { createGithubClient } from "@/lib/scene-builder-github";
import { GITHUB_TOKEN_COOKIE, readCookie, readGithubToken } from "@/lib/scene-builder-oauth";
import { isGithubModeConfigured } from "@/lib/scene-builder-write";
import { createSceneStub } from "@/lib/scene-builder-create";

interface NewScenePostBody {
  subject: string;
  slug: string;
  title: string;
}

function parseBody(value: unknown): NewScenePostBody | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.subject !== "string" ||
    typeof record.slug !== "string" ||
    typeof record.title !== "string"
  ) {
    return null;
  }
  return { subject: record.subject, slug: record.slug, title: record.title };
}

// Backs the "New visualization" form (components/site/scene-builder/
// new-visualization-form.tsx) — creates the placeholder-filled stub
// editorial that flow needs before the scene builder itself has anything
// to save into. Same auth shape as app/api/scene-builder/route.ts
// (SEC-001-style per-request session check, independent of middleware.ts's
// isAdminSurfaceEnabled() env-level gate) — deliberately duplicated rather
// than factored out, since that route's body-parsing and the write-vs-create
// branching below it are genuinely different per-route concerns; only the
// auth preamble is identical, and it's short enough that sharing it would
// cost more in indirection than it'd save.
export async function POST(request: Request) {
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
      { error: "subject, slug, and title are all required." },
      { status: 400 },
    );
  }

  let githubClient;
  if (isGithubModeConfigured()) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = readGithubToken(readCookie(cookieHeader, GITHUB_TOKEN_COOKIE));
    if (!token) {
      return NextResponse.json(
        {
          error:
            "GitHub authorization required. Visit /api/scene-builder/github-oauth/start, then try again.",
        },
        { status: 401 },
      );
    }
    githubClient = createGithubClient(token);
  }

  const result = await createSceneStub(body, { githubClient });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
