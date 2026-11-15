import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPayload, isEmailConfigured, sendEmail } from "./email";

describe("lib/email", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });
  afterEach(() => vi.restoreAllMocks());

  it("is not configured unless BOTH variables are set", () => {
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "k";
    expect(isEmailConfigured()).toBe(false);
    process.env.EMAIL_FROM = "Cherenkov <no-reply@example.com>";
    expect(isEmailConfigured()).toBe(true);
  });

  it("refuses to send when unconfigured", async () => {
    await expect(sendEmail({ to: "a@b.c", subject: "s", text: "t" })).rejects.toThrow(/not configured/);
  });

  it("posts to the provider with a bearer key and throws on a non-2xx answer", async () => {
    process.env.RESEND_API_KEY = "secret";
    process.env.EMAIL_FROM = "from@example.com";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail({ to: "a@b.c", subject: "s", text: "t" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 422 })));
    await expect(sendEmail({ to: "a@b.c", subject: "s", text: "t" })).rejects.toThrow(/422/);
    vi.unstubAllGlobals();
  });
});

describe("buildPayload", () => {
  beforeEach(() => {
    delete process.env.EMAIL_REPLY_TO;
  });
  afterEach(() => {
    delete process.env.EMAIL_REPLY_TO;
  });

  it("sends plain text only, with no reply_to, when nothing optional is set", () => {
    const payload = buildPayload({ from: "f@x.y", to: "a@b.c", subject: "s", text: "t" });
    expect(payload).toEqual({ from: "f@x.y", to: "a@b.c", subject: "s", text: "t" });
    expect(payload).not.toHaveProperty("reply_to");
    expect(payload).not.toHaveProperty("html");
  });

  it("adds html and reply_to when given, keeping the text fallback", () => {
    const payload = buildPayload({
      from: "f@x.y",
      to: "a@b.c",
      subject: "s",
      text: "t",
      html: "<p>t</p>",
      replyTo: "help@x.y",
    });
    expect(payload).toMatchObject({ text: "t", html: "<p>t</p>", reply_to: "help@x.y" });
  });

  it("falls back to EMAIL_REPLY_TO, and a per-message replyTo wins over it", () => {
    process.env.EMAIL_REPLY_TO = " env@x.y ";
    expect(buildPayload({ from: "f", to: "a", subject: "s", text: "t" })).toMatchObject({ reply_to: "env@x.y" });
    expect(buildPayload({ from: "f", to: "a", subject: "s", text: "t", replyTo: "own@x.y" })).toMatchObject({
      reply_to: "own@x.y",
    });
  });

  it("ignores a blank EMAIL_REPLY_TO", () => {
    process.env.EMAIL_REPLY_TO = "   ";
    expect(buildPayload({ from: "f", to: "a", subject: "s", text: "t" })).not.toHaveProperty("reply_to");
  });

  it("does not make EMAIL_REPLY_TO part of isEmailConfigured()", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.EMAIL_REPLY_TO = "help@x.y";
    expect(isEmailConfigured()).toBe(false);
  });
});
