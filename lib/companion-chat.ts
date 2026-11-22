// Pure helpers for the companion's AI chat route (app/api/companion/chat),
// kept apart from the route so they can be tested without a database or the
// provider.

export type ChatMessage = { role: "user" | "model"; text: string };

/**
 * Shapes the conversation the way a chat model expects it: it starts with the
 * student's turn, and the turns alternate.
 *
 * The browser only keeps the last six messages, so from the fourth exchange on
 * its window starts with a model reply whose question has already been cut
 * off. A request that fails also leaves the student's message in the history,
 * so the next request can hold two student turns in a row. Leading model
 * turns are dropped, and runs of the same role are joined into one turn, so
 * nothing the student wrote is lost.
 *
 * The caller has already checked that the last message is a student turn, so
 * the result is never empty.
 */
export function normaliseConversation(messages: readonly ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    if (result.length === 0 && message.role === "model") continue;
    const last = result[result.length - 1];
    if (last && last.role === message.role) {
      last.text = `${last.text}\n\n${message.text}`;
    } else {
      result.push({ role: message.role, text: message.text });
    }
  }
  return result;
}

export type ChatFailure = {
  error:
    | "provider_quota"
    | "provider_unavailable"
    | "configuration"
    | "personal_quota"
    | "personal_key"
    | "personal_unavailable";
  status: 429 | 503;
};

function apiErrorStatus(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const err = (value as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return "";
  const status = (err as { status?: unknown }).status;
  return typeof status === "string" ? status.toUpperCase() : "";
}

/**
 * Maps a failed provider response to the error the student sees. `httpStatus`
 * is the provider's HTTP status and `body` its parsed JSON (or null when it
 * could not be read). A personal key gets its own error codes, so the student
 * can tell that their key, not Cherenkov's, is the problem.
 */
export function classifyProviderFailure(httpStatus: number, body: unknown, usingPersonalKey: boolean): ChatFailure {
  const quota: ChatFailure = { error: usingPersonalKey ? "personal_quota" : "provider_quota", status: 429 };
  const unavailable: ChatFailure = { error: usingPersonalKey ? "personal_unavailable" : "provider_unavailable", status: 503 };
  if (httpStatus === 429) return quota;
  if (httpStatus === 401 || httpStatus === 403) {
    return { error: usingPersonalKey ? "personal_key" : "configuration", status: 503 };
  }
  if (httpStatus === 503 || httpStatus >= 500) return unavailable;
  const status = apiErrorStatus(body);
  if (status === "RESOURCE_EXHAUSTED" || status === "UNAVAILABLE") return quota;
  return unavailable;
}

/**
 * Reads how a provider reply ended. Gemini reports `MAX_TOKENS` when the reply
 * was cut off by the output ceiling.
 */
export function wasTruncated(candidate: unknown): boolean {
  if (typeof candidate !== "object" || candidate === null) return false;
  return (candidate as { finishReason?: unknown }).finishReason === "MAX_TOKENS";
}
