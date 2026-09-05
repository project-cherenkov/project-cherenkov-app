import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail } from "@/lib/admin-guard";
import {
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_RETURN_TO_COOKIE,
  GITHUB_TOKEN_COOKIE,
  readCookie,
  signGithubToken,
  verifyGithubOauthState,
} from "@/lib/scene-builder-oauth";

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

function isSafeReturnTo(value: string | null | undefined): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//");
}

export async function GET(request: Request) {
  // Same per-request session+admin check as the start route and the
  // write-back route (NFR-4) — this callback still runs in the browser
  // session of whoever clicked "authorize," so it must still be an
  // authenticated content editor.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Content editor authorization required." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state") ?? undefined;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = readCookie(cookieHeader, GITHUB_OAUTH_STATE_COOKIE);
  const storedReturnTo = readCookie(cookieHeader, GITHUB_RETURN_TO_COOKIE);
  const returnTo = isSafeReturnTo(storedReturnTo)
    ? storedReturnTo
    : "/keystatic/scene-builder";

  // CSRF check: the state GitHub echoes back must match the one this app
  // minted and stashed in a cookie only it could have set.
  if (!code || !verifyGithubOauthState(stateCookie, state)) {
    return NextResponse.json({ error: "Invalid or expired GitHub OAuth state." }, { status: 400 });
  }

  const clientId = process.env.KEYSTATIC_GITHUB_CLIENT_ID;
  const clientSecret = process.env.KEYSTATIC_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GitHub OAuth is not configured." }, { status: 503 });
  }

  let tokenJson: GithubTokenResponse;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) {
      return NextResponse.json({ error: "GitHub token exchange failed." }, { status: 502 });
    }
    tokenJson = (await tokenRes.json()) as GithubTokenResponse;
  } catch {
    return NextResponse.json({ error: "GitHub token exchange failed." }, { status: 502 });
  }

  if (!tokenJson.access_token) {
    return NextResponse.json(
      { error: tokenJson.error_description ?? tokenJson.error ?? "GitHub token exchange failed." },
      { status: 502 },
    );
  }

  const response = NextResponse.redirect(new URL(returnTo, requestUrl.origin));
  response.cookies.set(GITHUB_TOKEN_COOKIE, signGithubToken(tokenJson.access_token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  response.cookies.delete(GITHUB_OAUTH_STATE_COOKIE);
  response.cookies.delete(GITHUB_RETURN_TO_COOKIE);
  return response;
}
