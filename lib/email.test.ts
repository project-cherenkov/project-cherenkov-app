import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEmailConfigured, sendEmail } from "./email";

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
