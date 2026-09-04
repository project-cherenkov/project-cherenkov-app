import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import {
  createGithubOauthState,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_RETURN_TO_COOKIE,
} from "@/lib/scene-builder-oauth";

const OAUTH_COOKIE_MAX_AGE_SECONDS = 600; // matches scene-builder-oauth.ts's 10-minute state TTL

function isSafeReturnTo(value: string | null): boolean {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

// This route sits under /api/scene-builder, already covered by
// middleware.ts's ADMIN_SURFACE_PREFIXES env-level gate — but per NFR-4
// ("session + isAdminEmail check before touching anything else"), it also
// does its own per-request check here, same as the write-back route,
// rather than relying solely on that outer gate.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  }

  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GitHub OAuth is not configured." }, { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const requestedReturnTo = requestUrl.searchParams.get("returnTo");
  const returnTo = isSafeReturnTo(requestedReturnTo)
    ? requestedReturnTo
    : "/keystatic/scene-builder";
  const callbackUrl = new URL("/api/scene-builder/github-oauth/callback", requestUrl.origin);

  const { state, cookieValue } = createGithubOauthState();

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("scope", "repo");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  };
  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, cookieValue, cookieOptions);
  response.cookies.set(GITHUB_RETURN_TO_COOKIE, returnTo, cookieOptions);
  return response;
}
