// Shared layout for every transactional email. Each message is rendered twice
// from the same content: a plain-text body (always sent, so the email still
// works in text-only clients and is what spam filters weigh most) and a small
// HTML body with inline styles only (no remote images, no tracking).
//
// Copy is English only: the server hooks that send these emails do not know the
// recipient's locale. A bilingual version would need the locale stored per user.
//
// Never put a password or a token in anything except the one link the message
// exists to deliver.

const siteName = "Project Cherenkov";

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

interface EmailParts {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  // Shown after the action, e.g. "If you did not ask for this, ignore it."
  footnote?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(parts: EmailParts): EmailContent {
  const footer = `${siteName} · student-run olympiad editorial project`;

  const textBlocks = [parts.heading, ...parts.paragraphs];
  if (parts.action) textBlocks.push(`${parts.action.label}:\n${parts.action.url}`);
  if (parts.footnote) textBlocks.push(parts.footnote);
  textBlocks.push(`--\n${footer}`);
  const text = textBlocks.join("\n\n");

  const body = parts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join("");
  const button = parts.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(parts.action.url)}" style="display:inline-block;padding:10px 18px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(parts.action.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#555">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(parts.action.url)}</span></p>`
    : "";
  const note = parts.footnote
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#555">${escapeHtml(parts.footnote)}</p>`
    : "";
  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a2e">` +
    `<div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px;border-radius:8px">` +
    `<h1 style="margin:0 0 20px;font-size:20px">${escapeHtml(parts.heading)}</h1>` +
    body +
    button +
    note +
    `<hr style="border:none;border-top:1px solid #e3e3e8;margin:24px 0 12px">` +
    `<p style="margin:0;font-size:12px;color:#777">${escapeHtml(footer)}</p>` +
    `</div></body></html>`;

  return { subject: parts.subject, text, html };
}

export function verificationEmail(url: string): EmailContent {
  return renderEmail({
    subject: `Verify your email for ${siteName}`,
    heading: "Verify your email address",
    paragraphs: [
      `Thanks for creating a ${siteName} account. Confirm that this address is yours to finish setting it up. The link is valid for 24 hours.`,
    ],
    action: { label: "Verify email", url },
    footnote: "If you did not create an account, you can ignore this email.",
  });
}

export function resetPasswordEmail(url: string): EmailContent {
  return renderEmail({
    subject: `Reset your ${siteName} password`,
    heading: "Reset your password",
    paragraphs: ["Use the link below to choose a new password. It is valid for one hour."],
    action: { label: "Choose a new password", url },
    footnote: "If you did not ask for this, ignore this email. Your password stays as it is.",
  });
}

export function deleteAccountEmail(url: string): EmailContent {
  return renderEmail({
    subject: `Confirm deleting your ${siteName} account`,
    heading: "Confirm account deletion",
    paragraphs: [
      "You asked to delete your account. Deleting it permanently removes your account and the study data stored with it, such as quiz answers, study sessions, planner settings and saved preferences. This cannot be undone.",
      "To confirm, sign in on the device you normally use, then open the link below. It is valid for one hour and only works while you are signed in to this account.",
    ],
    action: { label: "Delete my account", url },
    footnote: "If you did not ask for this, ignore this email and nothing will be deleted. Consider changing your password.",
  });
}

// `when` is rendered in UTC so the wording is the same wherever it is read.
export function formatUtcTimestamp(when: Date): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(when);
  return `${formatted} UTC`;
}

export function passwordChangedEmail({
  when,
  resetUrl,
}: {
  when: Date;
  // Where to go if this was not the account owner. Omitted when the site's
  // address is not configured, in which case the message says to use the
  // "Forgot password?" link instead.
  resetUrl?: string;
}): EmailContent {
  const paragraphs = [
    `The password for your ${siteName} account was changed on ${formatUtcTimestamp(when)}.`,
    "If this was you, nothing more is needed.",
    "If it was not you, reset your password straight away, which also signs out everyone else.",
  ];
  return renderEmail({
    subject: `Your ${siteName} password was changed`,
    heading: "Your password was changed",
    paragraphs,
    ...(resetUrl ? { action: { label: "Reset your password", url: resetUrl } } : {}),
    ...(resetUrl ? {} : { footnote: 'Use "Forgot password?" on the login page to reset it.' }),
  });
}
