import type { ReactNode } from "react";
import type { TopicStatus } from "@/lib/planner";

export interface ChapterViewLabels {
  backToPlanner: string;
  openEditorial: string;
  noEditorial: string;
  statusDone: string;
  statusInProgress: string;
  statusNotStarted: string;
}

export interface ChapterViewProps {
  labels: ChapterViewLabels;
  title: string;
  status: TopicStatus;
  editorialHref: string | null;
  plannerHref: string;
  // Injected, same reasoning as PlanOverview's generatePlanForm — keeps
  // this component a pure function of its props, independent of the quiz's
  // Server Action / client-state wiring.
  quizDialog: ReactNode;
}

function statusLabel(status: TopicStatus, labels: ChapterViewLabels): string {
  switch (status) {
    case "done":
      return labels.statusDone;
    case "in_progress":
      return labels.statusInProgress;
    case "not_started":
      return labels.statusNotStarted;
  }
}

// PLANNER-003. Deep-links to the Phase 1 archive via editorialHref rather
// than duplicating editorial content (spec §4) — editorialHref is null when
// the topic has no linked editorial yet (lib/db/schema.ts's topics.editorialSlug
// is nullable).
export function ChapterView({
  labels,
  title,
  status,
  editorialHref,
  plannerHref,
  quizDialog,
}: ChapterViewProps) {
  return (
    <div>
      <a href={plannerHref}>{labels.backToPlanner}</a>
      <h1>{title}</h1>
      <p>{statusLabel(status, labels)}</p>
      {editorialHref ? (
        <a href={editorialHref}>{labels.openEditorial}</a>
      ) : (
        <p>{labels.noEditorial}</p>
      )}
      {quizDialog}
    </div>
  );
}
