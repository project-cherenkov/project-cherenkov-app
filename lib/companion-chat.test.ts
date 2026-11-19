import { describe, expect, it } from "vitest";
import { classifyProviderFailure, normaliseConversation, type ChatMessage } from "./companion-chat";

const u = (text: string): ChatMessage => ({ role: "user", text });
const m = (text: string): ChatMessage => ({ role: "model", text });

describe("normaliseConversation", () => {
  it("leaves a conversation that starts with the student and alternates untouched", () => {
    const messages = [u("a"), m("b"), u("c")];
    expect(normaliseConversation(messages)).toEqual(messages);
  });

  it("drops the model replies at the start that the browser's six-message window leaves behind", () => {
    // The browser's window after three exchanges plus a new question.
    expect(normaliseConversation([m("r1"), u("q2"), m("r2"), u("q3"), m("r3"), u("q4")])).toEqual([
      u("q2"), m("r2"), u("q3"), m("r3"), u("q4"),
    ]);
  });

  it("joins two student turns in a row, as a failed request leaves behind, without losing either", () => {
    expect(normaliseConversation([u("first try"), u("second try")])).toEqual([u("first try\n\nsecond try")]);
    expect(normaliseConversation([u("a"), m("b"), u("lost"), u("again")])).toEqual([u("a"), m("b"), u("lost\n\nagain")]);
  });

  it("does not change the messages it is given", () => {
    const messages = [u("a"), u("b")];
    normaliseConversation(messages);
    expect(messages).toEqual([u("a"), u("b")]);
  });

  it("always starts with the student when the last message is the student's", () => {
    for (const messages of [[m("x"), u("y")], [m("x"), m("y"), u("z")], [u("only")]]) {
      const result = normaliseConversation(messages);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.role).toBe("user");
      expect(result[result.length - 1]!.role).toBe("user");
    }
  });
});

describe("classifyProviderFailure", () => {
  it("maps rate limits to a quota error", () => {
    expect(classifyProviderFailure(429, null, false)).toEqual({ error: "provider_quota", status: 429 });
    expect(classifyProviderFailure(429, null, true)).toEqual({ error: "personal_quota", status: 429 });
  });

  it("maps refused credentials to a configuration error, or a personal-key error", () => {
    expect(classifyProviderFailure(401, null, false)).toEqual({ error: "configuration", status: 503 });
    expect(classifyProviderFailure(403, null, false)).toEqual({ error: "configuration", status: 503 });
    expect(classifyProviderFailure(403, null, true)).toEqual({ error: "personal_key", status: 503 });
  });

  it("maps server errors to unavailable", () => {
    expect(classifyProviderFailure(500, null, false)).toEqual({ error: "provider_unavailable", status: 503 });
    expect(classifyProviderFailure(503, null, true)).toEqual({ error: "personal_unavailable", status: 503 });
  });

  it("reads quota exhaustion from the body of an otherwise unremarkable error", () => {
    expect(classifyProviderFailure(400, { error: { status: "RESOURCE_EXHAUSTED" } }, false)).toEqual({ error: "provider_quota", status: 429 });
    expect(classifyProviderFailure(400, { error: { status: "unavailable" } }, true)).toEqual({ error: "personal_quota", status: 429 });
  });

  it("treats anything else, including an unreadable body, as unavailable", () => {
    expect(classifyProviderFailure(400, { error: { status: "INVALID_ARGUMENT" } }, false)).toEqual({ error: "provider_unavailable", status: 503 });
    expect(classifyProviderFailure(404, "nonsense", false)).toEqual({ error: "provider_unavailable", status: 503 });
  });
});
