import { describe, expect, it } from "vitest";
import { chatTitleFromMessage, checkChatLimits, isChatId } from "./companion-chat-history";

describe("chatTitleFromMessage", () => {
  it("is one line and at most 40 characters", () => {
    expect(chatTitleFromMessage("  What is\n\n a   photon? ")).toBe("What is a photon?");
    const title = chatTitleFromMessage("x".repeat(100));
    expect(title).toHaveLength(40);
    expect(title.endsWith("\u2026")).toBe(true);
  });
});

describe("checkChatLimits", () => {
  it("blocks a new chat at 15 saved chats, not at 14", () => {
    expect(checkChatLimits({ chatId: null, chatCount: 14, messageCount: 0 })).toBeNull();
    expect(checkChatLimits({ chatId: null, chatCount: 15, messageCount: 0 })).toBe("chat_limit");
  });
  it("blocks a chat that has no room for another exchange", () => {
    expect(checkChatLimits({ chatId: "x", chatCount: 3, messageCount: 28 })).toBeNull();
    expect(checkChatLimits({ chatId: "x", chatCount: 3, messageCount: 29 })).toBe("chat_full");
    expect(checkChatLimits({ chatId: "x", chatCount: 3, messageCount: 30 })).toBe("chat_full");
  });
});

describe("isChatId", () => {
  it("accepts only uuids", () => {
    expect(isChatId("7d3f2a4e-1b5c-4e8a-9c0d-2f6b8a1e3c5d")).toBe(true);
    expect(isChatId("nope")).toBe(false);
    expect(isChatId(undefined)).toBe(false);
  });
});
