// Server-only: does THIS request come from an editor?
//
// "Editor" means the same thing everywhere else on the site (the Account
// page's "Primus Inter Pares" role, the header's Edit link — see
// app/api/account/edit-access/route.ts): signed in, email in ADMIN_EMAILS, and
// the admin surface switched on. Archived editorials and materials are shown
// only when this is true.
//
// Unlike the Edit link, which is a display hint, this one GATES content, so it
// fails closed: any error while resolving the session counts as "not an
// editor". Reading the session touches request headers, which makes the
// calling route dynamic — so call it only once an archived item is actually
// involved (or on a page that is already dynamic), never on every request to a
// published page.
import { getCurrentUser } from "@/lib/auth-guard";
import { isAdminEmail, isAdminSurfaceEnabled } from "@/lib/admin-guard";

export async function isEditorRequest(): Promise<boolean> {
  try {
    if (!isAdminSurfaceEnabled()) return false;
    const user = await getCurrentUser();
    return user !== null && isAdminEmail(user.email);
  } catch {
    return false;
  }
}
