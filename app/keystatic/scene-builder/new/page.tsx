import { NewVisualizationForm } from "@/components/site/scene-builder/new-visualization-form";

// Reached from the "+ New visualization" entry point rendered in
// app/keystatic/layout.tsx (alongside <KeystaticApp/>, not inside it — see
// that file's own comment for why), and directly at this URL. Same "no auth
// of its own at this route" note as /keystatic/scene-builder and
// /keystatic/team-photo: real access control is /api/scene-builder/new's
// job, enforced server-side per request (see that route).
export default function NewVisualizationPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-bold text-foreground">New visualization</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Creates a minimal draft editorial — title only; everything else undecided gets a clearly
        marked placeholder, the same convention every hand-authored editorial in this repo
        already uses — then opens the scene builder for it, targeted and ready.
      </p>
      <div className="mt-6">
        <NewVisualizationForm />
      </div>
    </div>
  );
}
