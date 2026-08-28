import type { ReactNode } from "react";
import type { TopicStatus } from "@/lib/planner";

export interface PlanOverviewLabels {
  overviewHeading: string;
  generatePlanPrompt: string;
  generatePlanBody: string;
  statusDone: string;
  statusInProgress: string;
  statusNotStarted: string;
  scheduledForPrefix: string;
}

export interface PlanOverviewItem {
  topicId: string;
  subject: string;
  chapter: string;
  title: string;
  status: TopicStatus;
  scheduledFor: string;
}

export interface PlanOverviewProps {
  labels: PlanOverviewLabels;
  hasPlan: boolean;
  items: PlanOverviewItem[];
  locale: string;
  // The interactive "generate/regenerate" form is injected as a child
  // rather than rendered internally, so this component stays a pure,
  // presentation-only function of its props — no client-side state, no
  // Server Action wiring, nothing that would need a live database or
  // router context to render (PLANNER-003's required render-path test
  // renders this component directly for exactly that reason).
  generatePlanForm: ReactNode;
}

function statusLabel(status: TopicStatus, labels: PlanOverviewLabels): string {
  switch (status) {
    case "done":
      return labels.statusDone;
    case "in_progress":
      return labels.statusInProgress;
    case "not_started":
      return labels.statusNotStarted;
  }
}

// PLANNER-003. Empty behaviour (spec §6): a user with no study_plans row
// yet sees a "generate your plan" prompt, not an error and not a
// silently-empty page.
export function PlanOverview({
  labels,
  hasPlan,
  items,
  locale,
  generatePlanForm,
}: PlanOverviewProps) {
  if (!hasPlan) {
    return (
      <div data-testid="planner-empty-state">
        <h1>{labels.overviewHeading}</h1>
        <p>{labels.generatePlanPrompt}</p>
        <p>{labels.generatePlanBody}</p>
        {generatePlanForm}
      </div>
    );
  }

  return (
    <div data-testid="planner-populated-state">
      <h1>{labels.overviewHeading}</h1>
      {generatePlanForm}
      <ul>
        {items.map((item) => (
          <li key={item.topicId}>
            {/* Plain <a>, not next-intl's Link: keeps this component free of
                any router/navigation context dependency (see the
                generatePlanForm comment above) — a real client-side
                transition isn't essential for this list.
                ROBUST-003 / TICKET-06: item.subject/item.chapter are
                encoded — chapter is seeded from each editorial's free-text
                `principle` field (velite.config.ts), so it isn't
                guaranteed to already be a URL-safe slug. */}
            <a
              href={`/${locale}/planner/${encodeURIComponent(item.subject)}/${encodeURIComponent(item.chapter)}`}
            >
              {item.title}
            </a>
            <span>{statusLabel(item.status, labels)}</span>
            <span>
              {labels.scheduledForPrefix} {item.scheduledFor}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
