import { readFile } from "node:fs/promises";
import path from "node:path";

export type LegalDoc = "privacy" | "terms";

// English lives in the repo-root PRIVACY.md / TERMS.md (what GitHub shows);
// Indonesian lives in content/legal/id/. The site renders whichever matches
// the visitor's language, falling back to English.
export async function readLegalDoc(doc: LegalDoc, locale: string): Promise<string> {
  const root = process.cwd();
  const file =
    locale === "id"
      ? path.join(root, "content", "legal", "id", `${doc}.md`)
      : path.join(root, doc === "privacy" ? "PRIVACY.md" : "TERMS.md");
  return readFile(file, "utf8");
}
