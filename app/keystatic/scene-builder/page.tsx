import Link from "next/link";
import { SceneBuilderApp } from "@/components/site/scene-builder/scene-builder-app";

interface SceneBuilderSearchParams {
  subject?: string;
  slug?: string;
}

// Deliberately placed under /keystatic (excluded from the locale-prefix
// middleware, see middleware.ts) alongside team-photo — same "no auth of
// its own at this route" note applies here (real access control is
// /api/scene-builder's job, enforced server-side per request; see that
// route and lib/admin-guard.ts). Reached from a specific editorial's
// vizConfig field description (SCENE-009) with ?subject=&slug= already
// filled in; the fields inside SceneBuilderApp are the fallback for
// reaching this page directly.
export default async function SceneBuilderPage({
  searchParams,
}: {
  searchParams: Promise<SceneBuilderSearchParams>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-xl font-bold text-foreground">Scene builder</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Compose a <code className="font-mono">composed-scene</code> visualization from reusable
        element templates, preview it live, and save it into an editorial&apos;s{" "}
        <code className="font-mono">vizConfig</code> from{" "}
        <Link href="/keystatic" className="underline">
          /keystatic
        </Link>
        .
      </p>
      <div className="mt-6">
        <SceneBuilderApp initialSubject={params.subject} initialSlug={params.slug} />
      </div>
    </div>
  );
}
