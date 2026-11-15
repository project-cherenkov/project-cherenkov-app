import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatUtcTimestamp,
  passwordChangedEmail,
  renderEmail,
  resetPasswordEmail,
  verificationEmail,
} from "./email-templates";

const URL_WITH_TOKEN = "https://www.example.com/api/auth/verify-email?token=abc&callbackURL=%2Fid%2Femail-verified";

describe("renderEmail", () => {
  it("always returns a plain-text body that contains the link, and an html body", () => {
    const mail = verificationEmail(URL_WITH_TOKEN);
    expect(mail.text).toContain(URL_WITH_TOKEN);
    expect(mail.html).toContain("<a href=");
    expect(mail.subject).toMatch(/verify/i);
  });

  it("escapes html in every interpolated value", () => {
    const mail = renderEmail({
      subject: "s",
      heading: "<b>h</b>",
      paragraphs: ['a "quoted" <script>alert(1)</script>'],
      action: { label: "Go", url: 'https://x.y/?a=1&b="2"' },
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<b>h</b>");
    expect(mail.html).toContain("&amp;b=&quot;2&quot;");
    // The text body is not HTML, so it keeps the raw characters.
    expect(mail.text).toContain('https://x.y/?a=1&b="2"');
  });

  it("uses only inline styles and no remote assets", () => {
    const { html } = resetPasswordEmail("https://x.y/reset");
    expect(html).not.toMatch(/<img|<link|<script|src=/i);
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("passwordChangedEmail", () => {
  const when = new Date("2026-11-14T06:52:00Z");

  it("states when it happened in UTC and tells the reader what to do if it was not them", () => {
    expect(formatUtcTimestamp(when)).toBe("14 November 2026 at 06:52 UTC");
    const mail = passwordChangedEmail({ when, resetUrl: "https://x.y/forgot-password" });
    expect(mail.text).toContain("14 November 2026 at 06:52 UTC");
    expect(mail.text).toMatch(/if it was not you, reset your password/i);
    expect(mail.text).toContain("https://x.y/forgot-password");
  });

  it("falls back to wording when no reset link can be built", () => {
    const mail = passwordChangedEmail({ when });
    expect(mail.text).toContain("Forgot password?");
    expect(mail.text).not.toContain("http");
  });

  it("never contains a password or token-like field", () => {
    const mail = passwordChangedEmail({ when, resetUrl: "https://x.y/forgot-password" });
    expect(mail.text.toLowerCase()).not.toContain("token");
    expect(mail.html.toLowerCase()).not.toContain("token");
  });
});
