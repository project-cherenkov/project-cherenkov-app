// "Try it first" preference (R5): a reader may opt in to having worked
// solutions and proofs collapsed until they ask for them. OPT-IN, never the
// default: rigorous proofs are the product, and experienced readers should get
// them immediately. The choice lives only in this browser's localStorage; it
// is never sent anywhere.
//
// Everyone sees the full text in the server-rendered HTML (so search engines,
// printing and no-JS readers are unaffected); the collapse only happens in the
// browser, for readers who turned it on.
export const TRY_FIRST_STORAGE_KEY = "cherenkov.try-first.v1";
export const TRY_FIRST_EVENT = "cherenkov:try-first-change";

export function parseTryFirst(raw: string | null | undefined): boolean {
  return raw === "1";
}

export function serializeTryFirst(on: boolean): string {
  return on ? "1" : "0";
}
