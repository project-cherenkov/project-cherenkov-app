import { defineBank } from "./define";

// STATUS: AI-generated DRAFT, not editor-reviewed. This is the one example
// question that the original seed script (scripts/seed-quiz-questions.ts)
// attached to the eccentric-transit-duration editorial, re-homed on the
// celestial-mechanics syllabus topic (Kepler's laws) and given a difficulty
// label. The rest of astronomy has no questions yet.
export const astronomyQuestions = defineBank("astronomy", [
  {
    topic: "celestial-mechanics", d: "intermediate",
    q: "Why is it wrong to assume constant orbital speed when estimating an eccentric planet's transit duration?",
    c: [
      "Kepler's second law means the planet sweeps equal areas in equal time, so its speed varies with orbital position",
      "Transit duration depends only on the orbital period, never on speed",
      "The star's brightness changes the planet's velocity during transit",
      "Eccentricity affects orbit shape but never orbital speed",
    ],
    a: 0,
    why: "For an eccentric orbit, Kepler's second law means the planet moves fastest near periapsis and slowest near apoapsis — transit duration has to account for where in the orbit the transit occurs.",
  },
]);
