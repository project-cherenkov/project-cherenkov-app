// Minimal transactional-email sender, used only for password-reset links.
//
// DECISION FOR THE OWNER: the project had no email provider. This uses the
// Resend HTTP API because it needs no extra dependency (one fetch) and has a
// free tier, but nothing else in the codebase depends on that choice: swap the
// body of sendEmail() to move to another provider. With neither variable set,
// isEmailConfigured() is false, the "Forgot password?" link is hidden and the
// reset endpoint stays off, so a deployment without email behaves exactly as
// it did before.
//
//   RESEND_API_KEY   API key from the provider
//   EMAIL_FROM       a verified sender, e.g. "Cherenkov <no-reply@your-domain>"
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail({ to, subject, text }: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email is not configured (RESEND_API_KEY / EMAIL_FROM).");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!response.ok) {
    throw new Error(`Email provider rejected the message (HTTP ${response.status}).`);
  }
}
