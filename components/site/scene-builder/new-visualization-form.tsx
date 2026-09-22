"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SUBJECTS } from "@/lib/subjects";
import { buildGithubAuthorizeUrl, isGithubAuthRequiredError } from "@/lib/scene-builder-oauth-client";

type SceneEngine = "composed-scene" | "programmable-scene";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The "start fresh" counterpart to editing an existing editorial's scene:
// posts to /api/scene-builder/new (lib/scene-builder-create.ts), which
// creates a minimal, placeholder-filled stub editorial, then sends the
// author straight into the scene builder for it, pre-targeted via query
// params — the same A-1 "carries subject+slug as context" idea
// app/keystatic/scene-builder/page.tsx already uses for editorials that
// exist, extended to cover the moment before one does. This replaces the
// previous only option: create a full editorial by hand in Keystatic's own
// form, then copy its subject and slug into the scene-builder URL
// yourself.
//
// Slug validation is deliberately NOT duplicated here — isValidSlug lives
// in lib/scene-builder-write.ts, which imports node:fs/promises at module
// scope and so can't be pulled into a client bundle. The slugify() above is
// just a convenience default; the server is the single source of truth for
// what counts as valid, and its rejection reason (if any) is shown as-is.
export function NewVisualizationForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [engine, setEngine] = useState<SceneEngine>("composed-scene");
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // BUG FIX: previously this error rendered as dead-end text — the message
  // itself says to "visit /api/scene-builder/github-oauth/start", but
  // nothing made that a link, so a contributor without that URL memorized
  // was stuck. Detect the specific 401 both /new and /route.ts (save) share
  // and, only for that one, offer a real link back to this same form.
  const [needsGithubAuth, setNeedsGithubAuth] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const canSubmit = subject.length > 0 && title.trim().length > 0 && effectiveSlug.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "creating") return;
    setStatus("creating");
    setError(null);
    setNeedsGithubAuth(false);
    try {
      const res = await fetch("/api/scene-builder/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, slug: effectiveSlug, title: title.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Couldn't create the new visualization.");
        setNeedsGithubAuth(isGithubAuthRequiredError(data.error));
        return;
      }
      router.push(
        `/keystatic/scene-builder?subject=${encodeURIComponent(subject)}&slug=${encodeURIComponent(effectiveSlug)}&engine=${engine}`,
      );
    } catch {
      setStatus("error");
      setError("Couldn't create the new visualization — network error.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Subject</span>
        <select
          className="rounded-md border border-border bg-transparent px-2 py-1"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="" disabled>
            Choose a subject…
          </option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Title</span>
        <input
          type="text"
          placeholder="A short, descriptive title"
          className="rounded-md border border-border bg-transparent px-2 py-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">Slug</span>
        <input
          type="text"
          placeholder="binary-search-on-answer"
          className="rounded-md border border-border bg-transparent px-2 py-1"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </label>
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
        Filled in from the title until you edit it directly.
      </p>

      <div className="flex items-center gap-4 text-sm">
        <span className="label-code text-slate-600 dark:text-slate-300">Engine</span>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="new-visualization-engine"
            value="composed-scene"
            checked={engine === "composed-scene"}
            onChange={() => setEngine("composed-scene")}
          />
          Composed scene
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="new-visualization-engine"
            value="programmable-scene"
            checked={engine === "programmable-scene"}
            onChange={() => setEngine("programmable-scene")}
          />
          Programmable scene
        </label>
      </div>

      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cherenkov-blue px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-cherenkov-blue-pastel focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        disabled={!canSubmit || status === "creating"}
      >
        {status === "creating" ? "Creating…" : "Create and open the scene builder"}
      </button>
      {status === "error" && error && (
        <div className="text-sm text-red-700">
          <p>{error}</p>
          {needsGithubAuth && (
            <a
              className="font-medium underline underline-offset-2 hover:no-underline"
              href={buildGithubAuthorizeUrl(
                typeof window !== "undefined"
                  ? window.location.pathname + window.location.search
                  : "/keystatic/scene-builder/new",
              )}
            >
              Authorize with GitHub, then come back and try again
            </a>
          )}
        </div>
      )}
    </form>
  );
}
