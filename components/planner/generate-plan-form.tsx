"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "@/i18n/routing";
import { generatePlan } from "@/lib/planner-actions";
import { Button } from "@/components/ui/button";

export interface GeneratePlanFormLabels {
  examDateLabel: string;
  generateButton: string;
  regenerateButton: string;
}

export interface GeneratePlanFormProps {
  labels: GeneratePlanFormLabels;
  hasPlan: boolean;
  defaultExamDate?: string | null;
}

// PLANNER-002/003. Wires lib/planner-actions.ts's `generatePlan` Server
// Action to a simple date-picker form. Handles both "Generate plan" and
// "Regenerate plan" (spec §5's UI decision) with one action — decision #7
// means they're the same update-or-create operation underneath.
export function GeneratePlanForm({
  labels,
  hasPlan,
  defaultExamDate,
}: GeneratePlanFormProps) {
  const [examDate, setExamDate] = useState(defaultExamDate ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await generatePlan(examDate);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      // The Server Action mutated server state — refresh so the Server
      // Component page re-fetches the plan (the empty -> populated
      // transition, or a freshly regenerated schedule).
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {labels.examDateLabel}
        <input
          type="date"
          value={examDate}
          onChange={(event) => setExamDate(event.target.value)}
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <Button type="submit" disabled={isPending || !examDate}>
        {hasPlan ? labels.regenerateButton : labels.generateButton}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
