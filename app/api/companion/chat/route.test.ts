import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route runs against a fake database and a fake provider, so what it does
// with a student's daily request, and exactly what it sends to Gemini, can be
// checked without either.
const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  setting: { aiEnabled: true, aiAcknowledged: true } as { aiEnabled: boolean; aiAcknowledged: boolean } | null,
  usage: [{ requestCount: 1 }] as Array<{ requestCount: number }>,
  updates: 0,
}));

vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/db", () => {
  const select = () => ({ from: () => ({ where: () => ({ limit: async () => (state.setting ? [state.setting] : []) }) }) });
  const insert = () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => state.usage }) }) });
  const update = () => ({ set: () => ({ where: async () => { state.updates += 1; } }) });
  return { db: { select, insert, update } };
});

import { POST } from "./route";

const u = (text: string) => ({ role: "user", text });
const m = (text: string) => ({ role: "model", text });

function post(body: unknown) {
  return POST(new Request("http://test/api/companion/chat", { method: "POST", body: JSON.stringify(body) }));
}
function provider(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), ...response }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const reply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

beforeEach(() => {
  state.user = { id: "user-1" };
  state.setting = { aiEnabled: true, aiAcknowledged: true };
  state.usage = [{ requestCount: 1 }];
  state.updates = 0;
  process.env.GEMINI_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/companion/chat", () => {
  it("answers, and keeps the request counted, when the provider replies", async () => {
    provider({ json: async () => reply("Hello!") });
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "Hello!" });
    expect(state.updates).toBe(0);
  });

  it.each([
    ["the provider is down", { ok: false, status: 503 }, 503, "provider_unavailable"],
    ["the provider's own quota is used up", { ok: false, status: 429 }, 429, "provider_quota"],
    ["the provider refuses Cherenkov's key", { ok: false, status: 403 }, 503, "configuration"],
    ["the provider sends no text", { json: async () => ({ candidates: [] }) }, 503, "provider_unavailable"],
  ])("gives the request back when %s", async (_name, providerResponse, status, error) => {
    provider(providerResponse as Partial<Response>);
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(error);
    expect(state.updates).toBe(1);
  });

  it("gives the request back when the provider cannot be reached or times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("provider_unavailable");
    expect(state.updates).toBe(1);
  });

  it("uses the personal-key error codes, and still gives the request back, for a failing personal key", async () => {
    provider({ ok: false, status: 403 });
    const response = await post({ messages: [u("hi")], personalKey: "k", personalKeyConsent: true });
    expect((await response.json()).error).toBe("personal_key");
    expect(state.updates).toBe(1);
  });

  it("refuses at the daily limit without calling the provider or giving anything back", async () => {
    state.usage = [];
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cherenkov_limit");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updates).toBe(0);
  });

  it("sends the provider a conversation that starts with the student and alternates", async () => {
    const fetchMock = provider({ json: async () => reply("ok") });
    // The window the browser sends from the fourth exchange on, after a failed turn.
    await post({ messages: [m("r2"), u("q3"), m("r3"), u("lost"), u("q4")] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const contents = JSON.parse(init.body).contents as Array<{ role: string; parts: Array<{ text: string }> }>;
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(contents[2]!.parts[0]!.text).toBe("lost\n\nq4");
  });

  it("still validates the request before spending anything", async () => {
    const fetchMock = provider({});
    expect((await post({ messages: [m("no question")] })).status).toBe(400);
    expect((await post({ messages: [] })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updates).toBe(0);
  });
});
