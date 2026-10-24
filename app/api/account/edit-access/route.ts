import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail, isAdminSurfaceEnabled } from "@/lib/admin-guard";

// Answers one question for the site header: "should THIS visitor be shown the
// Edit (CMS) link?". It exists so the header can stay a static, cacheable
// shell for everybody and only ask once a session exists, instead of making
// every page dynamic by reading the session in the root layout.
//
// This is a display hint, NOT an authorization check. /keystatic and its API
// are still gated by middleware.ts and Keystatic's own GitHub login; a wrong
// answer here can only show or hide a link. Same rule as the Account page's
// "Primus Inter Pares" role (lib/account-roles.ts): the email is in
// ADMIN_EMAILS. The link is also hidden when the admin surface is switched
// off, because it would just lead to a 404.
export async function GET() {
  const user = await getCurrentUser();
  const canEdit = Boolean(user) && isAdminEmail(user!.email) && isAdminSurfaceEnabled();
  return NextResponse.json({ canEdit }, { headers: { "Cache-Control": "no-store" } });
}
