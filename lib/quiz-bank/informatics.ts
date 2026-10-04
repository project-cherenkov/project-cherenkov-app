import { defineBank } from "./define";

// STATUS: AI-generated DRAFT, not editor-reviewed. This is the one example
// question that the original seed script (scripts/seed-quiz-questions.ts)
// attached to the binary-search editorial, re-homed on its syllabus topic and
// given a difficulty label. The rest of informatics has no questions yet.
export const informaticsQuestions = defineBank("informatics", [
  {
    topic: "binary-search", d: "intermediate",
    q: "What property must the predicate have for binary search on the answer to work correctly?",
    c: [
      "It must be monotonic — it flips from false to true (or vice versa) exactly once",
      "The underlying array must be sorted numerically",
      "The predicate must be strictly increasing in value, not just in truth",
      "It must return true for every candidate answer",
    ],
    a: 0,
    why: "Binary search on the answer only needs the predicate to flip exactly once across the search space — sortedness of any underlying array is irrelevant.",
  },
]);
