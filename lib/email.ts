// Minimal transactional-email sender: verification links, password-reset links
// and security notices (see lib/email-templates.ts for the copy).
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
//   EMAIL_FROM       a verified sender on the SENDING subdomain, e.g.
//                    "Project Cherenkov <no-reply@mail.your-domain>". The root
//                    domain is kept free to receive mail (see
//                    docs/engineering/email-and-domain.md).
//   EMAIL_REPLY_TO   optional. A monitored address replies should go to.
//                    Unset means no Reply-To header is sent. It plays no part
//                    in isEmailConfigured().
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  // Always required: it is the fallback for clients that do not render HTML.
  text: string;
  html?: string;
  // Overrides EMAIL_REPLY_TO for this message only.
  replyTo?: string;
}

export async function sendEmail({ to, subject, text, html, replyTo }: OutgoingEmail): Promise<void> {
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
    body: JSON.stringify(buildPayload({ from, to, subject, text, html, replyTo })),
  });
  if (!response.ok) {
    throw new Error(`Email provider rejected the message (HTTP ${response.status}).`);
  }
}

// Pure, so the Reply-To / HTML handling is unit-tested without a network call.
// Resend's field is `reply_to`; optional fields are omitted entirely when unset.
export function buildPayload({
  from,
  to,
  subject,
  text,
  html,
  replyTo,
}: OutgoingEmail & { from: string }): Record<string, unknown> {
  const reply = (replyTo ?? process.env.EMAIL_REPLY_TO)?.trim();
  return {
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
    ...(reply ? { reply_to: reply } : {}),
  };
}
