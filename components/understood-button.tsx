"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { useSession } from "@/lib/auth-client";
import { getUnderstood, setUnderstoodMark } from "@/lib/study-session-actions";

// The student's own "I understood this" flag (R4). Shown only to signed-in
// readers: pages stay fully static and public, and the state is fetched
// after load. Deliberately separate from the mastery estimate: it records what
// the student says, and nothing here changes their plan or their estimate.
export function UnderstoodButton({
  kind,
  subject,
  slug,
}: {
  kind: "material" | "editorial";
  subject: string;
  slug: string;
}) {
  const t = useTranslations("understood");
  const { data: session } = useSession();
  const signedIn = Boolean(session);
  const [understood, setUnderstood] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    getUnderstood({ kind, subject, slug }).then((result) => {
      if (!cancelled && result.ok) setUnderstood(result.understood);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, kind, subject, slug]);

  if (!signedIn || understood === null) return null;

  function toggle() {
    const next = !understood;
    setFailed(false);
    setUnderstood(next); // optimistic; reverted below if the server says no
    startTransition(async () => {
      const result = await setUnderstoodMark({ kind, subject, slug, understood: next });
      if (!result.ok) {
        setUnderstood(!next);
        setFailed(true);
      } else {
        setUnderstood(result.understood);
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={understood}
        className={[
          "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
          understood
            ? "border-cherenkov-blue-800 bg-cherenkov-blue-800 text-white dark:border-cherenkov-blue-pastel dark:bg-cherenkov-blue-pastel dark:text-slate-900"
            : "border-border text-foreground hover:bg-slate-100 dark:hover:bg-slate-800",
        ].join(" ")}
      >
        <Check aria-hidden className={`h-4 w-4 ${understood ? "" : "opacity-40"}`} />
        {understood ? t("marked") : t("mark")}
      </button>
      {failed ? (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
