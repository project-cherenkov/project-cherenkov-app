import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route runs against a fake database and a fake provider, so what it does
// with a student's daily request, and exactly what it sends to Gemini, can be
// checked without either.
const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  setting: { aiEnabled: true, aiAcknowledged: true } as { aiEnabled: boolean; aiAcknowledged: boolean } | null,
  usage: [{ requestCount: 1 }] as Array<{ requestCount: number }>,
  updates: [] as Array<Record<string, unknown>>,
  chatCount: 0,
  ownedChat: true,
  messageCount: 0,
  inserted: [] as unknown[],
  usageValues: [] as unknown[],
  failMessageInsert: false,
}));

vi.mock("@/lib/auth-guard", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/companion-page-context", () => ({
  resolvePageContext: () => null,
  listContentIndex: () => [],
}));
vi.mock("@/lib/db", () => {
  // The route runs three kinds of read: the settings row, a count, and a
  // chat-ownership check. They are told apart by the columns asked for.
  const select = (fields?: Record<string, unknown>) => ({
    from: () => ({
      where: () => {
        const rows = fields && "total" in fields
          ? [{ total: state.messageCount > 0 ? state.messageCount : state.chatCount }]
          : fields && "id" in fields
            ? (state.ownedChat ? [{ id: "chat-1" }] : [])
            : state.setting ? [state.setting] : [];
        return Object.assign(Promise.resolve(rows), { limit: async () => rows });
      },
    }),
  });
  const insert = () => ({
    values: (values: unknown) => {
      if (Array.isArray(values)) {
        if (state.failMessageInsert) throw new Error("unique violation");
        state.inserted.push(values);
        return Promise.resolve();
      }
      if (values && typeof values === "object" && "usageDay" in values) {
        state.usageValues.push(values);
        return { onConflictDoUpdate: () => ({ returning: async () => state.usage }) };
      }
      state.inserted.push(values);
      return { returning: async () => [{ id: "new-chat" }] };
    },
  });
  const update = () => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => { state.updates.push(value); },
    }),
  });
  const tx = { select, insert, update };
  return { db: { select, insert, update, transaction: async (callback: (t: typeof tx) => unknown) => callback(tx) } };
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
const reply = (text: string, finishReason?: string) => ({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] });

beforeEach(() => {
  state.user = { id: "user-1" };
  state.setting = { aiEnabled: true, aiAcknowledged: true };
  state.usage = [{ requestCount: 1 }];
  state.updates = [];
  state.chatCount = 0;
  state.ownedChat = true;
  state.messageCount = 0;
  state.inserted = [];
  state.usageValues = [];
  state.failMessageInsert = false;
  process.env.GEMINI_API_KEY = "test-key";
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/companion/chat", () => {
  it("answers, and keeps the request counted, when the provider replies", async () => {
    provider({ json: async () => reply("Hello!") });
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ chatId: "new-chat", reply: "Hello!", truncated: false });
    expect(state.updates.filter((u) => "requestCount" in u)).toHaveLength(0);
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
    expect(state.updates).toHaveLength(1);
  });

  it("gives the request back when the provider cannot be reached or times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("provider_unavailable");
    expect(state.updates).toHaveLength(1);
  });

  it("uses the personal-key error codes, and still gives the request back, for a failing personal key", async () => {
    provider({ ok: false, status: 403 });
    const response = await post({ messages: [u("hi")], personalKey: "k", personalKeyConsent: true });
    expect((await response.json()).error).toBe("personal_key");
    expect(state.updates).toHaveLength(1);
  });

  it("refuses at the daily limit without calling the provider or giving anything back", async () => {
    state.usage = [];
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cherenkov_limit");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.updates).toHaveLength(0);
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
    expect(state.updates).toHaveLength(0);
  });

  it("asks for the output ceiling and Neutrino's own system prompt", async () => {
    const fetchMock = provider({ json: async () => reply("ok") });
    await post({ messages: [u("hi")] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const sent = JSON.parse(init.body);
    expect(sent.generationConfig.maxOutputTokens).toBe(1500);
    expect(sent.systemInstruction.parts[0].text).toContain("Neutrino");
  });

  it("reports a reply that was cut off by the token limit", async () => {
    provider({ json: async () => reply("Part one", "MAX_TOKENS") });
    const body = await (await post({ messages: [u("hi")] })).json();
    expect(body.truncated).toBe(true);
  });

  it("does not count a personal-key request towards the shared daily limit", async () => {
    provider({ json: async () => reply("ok") });
    const response = await post({ messages: [u("hi")], personalKey: "k", personalKeyConsent: true });
    expect(response.status).toBe(200);
    expect(state.usageValues[0]).toMatchObject({ requestCount: 0, personalRequestCount: 1 });
  });

  it("refuses a personal-key request at its own ceiling with personal_limit", async () => {
    state.usage = [];
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")], personalKey: "k", personalKeyConsent: true });
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("personal_limit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives back the personal counter, not the shared one, when a personal-key request fails", async () => {
    provider({ ok: false, status: 503 });
    await post({ messages: [u("hi")], personalKey: "k", personalKeyConsent: true });
    expect(Object.keys(state.updates[0]!)).toEqual(["personalRequestCount"]);
  });

  it("blocks a new chat at 15 saved chats before counting or calling the provider", async () => {
    state.chatCount = 15;
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")] });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("chat_limit");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.usageValues).toHaveLength(0);
  });

  it("blocks a chat that already holds 30 messages", async () => {
    state.messageCount = 30;
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")], chatId: "7d3f2a4e-1b5c-4e8a-9c0d-2f6b8a1e3c5d" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("chat_full");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.usageValues).toHaveLength(0);
  });

  it("answers 404 for a chat that is not the signed-in student's", async () => {
    state.ownedChat = false;
    const fetchMock = provider({});
    const response = await post({ messages: [u("hi")], chatId: "7d3f2a4e-1b5c-4e8a-9c0d-2f6b8a1e3c5d" });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a chat id that is not a uuid and a malformed page reference", async () => {
    provider({});
    expect((await post({ messages: [u("hi")], chatId: "1; drop table" })).status).toBe(400);
    expect((await post({ messages: [u("hi")], page: { kind: "editorial", subject: "../x", slug: "a" } })).status).toBe(400);
  });

  it("saves only the new student message and the reply, together", async () => {
    provider({ json: async () => reply("answer") });
    await post({ messages: [m("old"), u("one"), u("two")] });
    const saved = state.inserted.find(Array.isArray) as Array<{ role: string; body: string; position: number }>;
    expect(saved.map((row) => [row.position, row.role, row.body])).toEqual([[0, "user", "two"], [1, "model", "answer"]]);
  });

  it("gives the request back and answers 409 when another tab wrote to the chat first", async () => {
    state.failMessageInsert = true;
    provider({ json: async () => reply("answer") });
    const response = await post({ messages: [u("hi")], chatId: "7d3f2a4e-1b5c-4e8a-9c0d-2f6b8a1e3c5d" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("chat_conflict");
    expect(state.updates.some((u) => "requestCount" in u)).toBe(true);
  });
});
