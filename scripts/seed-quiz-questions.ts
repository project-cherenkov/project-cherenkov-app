// Decision #12 (conservative default): quiz-question authoring is a plain
// seed script for Phase 2, not a CMS UI — a full question bank is Optional
// scope (spec §10), not Required. This seeds exactly one example question
// per existing editorial's topic, purely so the quiz subsystem (QUIZ-001)
// is actually exercisable end-to-end in local dev. These are illustrative
// example questions grounded only in what's stated in each editorial's own
// frontmatter (hook/principle) — not a substitute for real, reviewed
// curriculum content. Run after scripts/seed-topics.ts (topics must exist
// first).
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { topics, quizQuestions } from "../lib/db/schema";

interface ExampleQuestion {
  editorialSlug: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
}

const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    editorialSlug: "binary-search-on-answer",
    prompt:
      "What property must the predicate have for binary search on the answer to work correctly?",
    choices: [
      "It must be monotonic — it flips from false to true (or vice versa) exactly once",
      "The underlying array must be sorted numerically",
      "The predicate must be strictly increasing in value, not just in truth",
      "It must return true for every candidate answer",
    ],
    correctChoiceIndex: 0,
    explanation:
      "Binary search on the answer only needs the predicate to flip exactly once across the search space — sortedness of any underlying array is irrelevant.",
  },
  {
    editorialSlug: "projectile-range-symmetry",
    prompt:
      "Ignoring air resistance, why do launch angles of 30° and 60° produce the same projectile range?",
    choices: [
      "Because sin(2·30°) = sin(2·60°)",
      "Because both angles give the same maximum height",
      "Because gravity acts differently at each angle",
      "Because the initial speed automatically adjusts to match",
    ],
    correctChoiceIndex: 0,
    explanation:
      "Range R = v²sin(2θ)/g. sin(60°) = sin(120°), so 30° and 60° give equal range despite very different trajectories.",
  },
  {
    editorialSlug: "eccentric-transit-duration",
    prompt:
      "Why is it wrong to assume constant orbital speed when estimating an eccentric planet's transit duration?",
    choices: [
      "Kepler's second law means the planet sweeps equal areas in equal time, so its speed varies with orbital position",
      "Transit duration depends only on the orbital period, never on speed",
      "The star's brightness changes the planet's velocity during transit",
      "Eccentricity affects orbit shape but never orbital speed",
    ],
    correctChoiceIndex: 0,
    explanation:
      "For an eccentric orbit, Kepler's second law means the planet moves fastest near periapsis and slowest near apoapsis — transit duration has to account for where in the orbit the transit occurs.",
  },
];

async function main() {
  let seeded = 0;

  for (const question of EXAMPLE_QUESTIONS) {
    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.editorialSlug, question.editorialSlug))
      .limit(1);

    if (!topic) {
      console.warn(
        `No topic found for editorialSlug "${question.editorialSlug}" — ` +
          "run scripts/seed-topics.ts first. Skipping.",
      );
      continue;
    }

    await db.insert(quizQuestions).values({
      topicId: topic.id,
      prompt: question.prompt,
      choices: question.choices,
      correctChoiceIndex: question.correctChoiceIndex,
      explanation: question.explanation,
    });
    seeded += 1;
  }

  console.log(`Seeded ${seeded} example quiz question(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("seed-quiz-questions failed:", error);
    process.exit(1);
  });
