import type { Subject } from "../subjects";
import type { BankEntry, BankQuestion } from "./types";

export function defineBank(
  subject: Subject,
  entries: BankEntry[],
): BankQuestion[] {
  return entries.map((entry) => ({
    key: `${subject}.${entry.topic}.${entry.d}.${entry.n ?? 1}`,
    subject,
    topicId: entry.topic,
    difficulty: entry.d,
    prompt: entry.q,
    choices: entry.c,
    correctChoiceIndex: entry.a,
    explanation: entry.why,
    status: entry.status ?? "draft",
  }));
}
