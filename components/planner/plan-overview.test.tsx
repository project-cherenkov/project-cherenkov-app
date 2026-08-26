import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanOverview, type PlanOverviewLabels } from "./plan-overview";

const labels: PlanOverviewLabels = {
  overviewHeading: "Your progress",
  generatePlanPrompt: "You don't have a study plan yet.",
  generatePlanBody: "Pick an exam date and we'll spread every topic evenly.",
  statusDone: "Done",
  statusInProgress: "In progress",
  statusNotStarted: "Not started",
  scheduledForPrefix: "Scheduled for",
};

// PLANNER-003 required test: "integration test covering the empty-state and
// populated-state render paths." Rendered directly via react-dom/server (no
// database, no router context, no next-intl request context needed) —
// PlanOverview is a pure function of its props by design (see its own
// header comment) specifically so this is possible without mocking Next's
// App Router internals.
describe("PlanOverview — render paths", () => {
  it("renders the empty-state prompt when the user has no plan yet", () => {
    const html = renderToStaticMarkup(
      <PlanOverview
        labels={labels}
        hasPlan={false}
        items={[]}
        locale="id"
        generatePlanForm={<button>Generate plan</button>}
      />,
    );

    expect(html).toContain("You don&#x27;t have a study plan yet.");
    expect(html).toContain("Generate plan");
    // No topic list should render in the empty state.
    expect(html).not.toContain("Scheduled for");
  });

  it("renders the populated state with topics, status, and schedule", () => {
    const html = renderToStaticMarkup(
      <PlanOverview
        labels={labels}
        hasPlan={true}
        locale="id"
        items={[
          {
            topicId: "t1",
            subject: "informatics",
            chapter: "monotonic-predicate-search",
            title: "Binary Search on the Answer",
            status: "done",
            scheduledFor: "2026-06-01",
          },
          {
            topicId: "t2",
            subject: "physics",
            chapter: "trigonometric-symmetry-in-kinematics",
            title: "Projectile Range Symmetry",
            status: "not_started",
            scheduledFor: "2026-06-02",
          },
        ]}
        generatePlanForm={<button>Regenerate plan</button>}
      />,
    );

    expect(html).toContain("Binary Search on the Answer");
    expect(html).toContain("Projectile Range Symmetry");
    expect(html).toContain("Done");
    expect(html).toContain("Not started");
    expect(html).toContain("Scheduled for 2026-06-01");
    expect(html).toContain("Regenerate plan");
    expect(html).toContain(
      '/id/planner/informatics/monotonic-predicate-search',
    );
    // The empty-state prompt should not leak into the populated state.
    expect(html).not.toContain("You don&#x27;t have a study plan yet.");
  });
});
