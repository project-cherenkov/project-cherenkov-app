"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Search, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import {
  FAQ_BY_ID,
  FAQ_GROUPS,
  FAQ_ITEMS,
  FAQ_LINKS,
  FAQ_VALUES,
  searchFaq,
  type FaqGroup,
  type FaqText,
} from "@/lib/neutrino-faq";

const questionButton =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const pillButton =
  "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const linkChip =
  "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium underline-offset-4 hover:bg-muted hover:underline";

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The pre-written side of the companion: a searchable, grouped list of
 * questions. Picking one shows the question and its answer like a short
 * conversation, with links to the right page and a few follow-up questions.
 * Nothing here touches the network; what the student types into the search
 * box never leaves the browser.
 */
export function NeutrinoFaq({
  name,
  onNavigate,
  onSwitchToAi,
}: {
  name: string;
  /** Called when an answer's link is followed (the in-page panel closes itself). */
  onNavigate?: () => void;
  /** Present only when AI chat is available, to offer it when nothing matches. */
  onSwitchToAi?: () => void;
}) {
  const t = useTranslations("companion");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<FaqGroup | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);

  const entries: Array<FaqText & { group: FaqGroup }> = useMemo(
    () =>
      FAQ_ITEMS.map((item) => ({
        id: item.id,
        group: item.group,
        question: t(`faq.items.${item.id}.q`, FAQ_VALUES),
        answer: t(`faq.items.${item.id}.a`, FAQ_VALUES),
      })),
    [t],
  );
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const searching = query.trim().length > 0;
  const visible = useMemo(() => {
    const inGroup = group ? entries.filter((entry) => entry.group === group) : entries;
    return searchFaq(inGroup, query);
  }, [entries, group, query]);

  // Bring the newest exchange to the top of the panel, so its question and the
  // start of its answer are both in view rather than only the end of a long answer.
  useEffect(() => {
    const container = scrollRef.current;
    const latest = latestRef.current;
    if (!container || !latest || history.length === 0) return;
    const top = container.scrollTop + (latest.getBoundingClientRect().top - container.getBoundingClientRect().top) - 8;
    container.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [history]);

  function pick(id: string) {
    setHistory((current) => [...current.filter((x) => x !== id), id]);
    setShowAll(false);
  }

  function startOver() {
    setHistory([]);
    setShowAll(false);
    setQuery("");
    setGroup(null);
  }

  const lastId = history[history.length - 1];
  const followUps = lastId ? (FAQ_BY_ID.get(lastId)?.related ?? []).filter((id) => !history.includes(id) && byId.has(id)).slice(0, 3) : [];
  const browsing = history.length === 0 || showAll;

  const list = (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={searchId} className="sr-only">{t("faq.searchLabel")}</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("faq.searchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-11 text-sm"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("faq.clearSearch")}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <label className="block">
          <span className="sr-only">{t("faq.groupsLabel")}</span>
          <select
            value={group ?? ""}
            onChange={(event) => setGroup(isGroup(event.target.value) ? event.target.value : null)}
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">{t("faq.allGroups")}</option>
            {FAQ_GROUPS.map((id) => (
              <option key={id} value={id}>{t(`faq.groups.${id}`)}</option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" className="text-xs text-muted-foreground">{t("faq.count", { count: visible.length })}</p>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <p className="text-muted-foreground">{t("faq.noResults", { query: query.trim() })}</p>
          {onSwitchToAi ? (
            <button type="button" onClick={onSwitchToAi} className={`${pillButton} mt-3 gap-2`}>
              <Bot className="h-4 w-4" aria-hidden /> {t("faq.tryAi")}
            </button>
          ) : null}
        </div>
      ) : searching || group ? (
        <ul className="space-y-2">
          {visible.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => pick(entry.id)} className={questionButton}>{entry.question}</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-5">
          {FAQ_GROUPS.map((id) => (
            <section key={id}>
              <h3 className="mb-2 text-sm font-semibold">{t(`faq.groups.${id}`)}</h3>
              <ul className="space-y-2">
                {visible.filter((entry) => entry.group === id).map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => pick(entry.id)} className={questionButton}>{entry.question}</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{t("faq.hello", { name })}</p>

      {history.length > 0 ? (
        <div className="space-y-4" aria-live="polite">
          {history.map((id, index) => {
            const entry = byId.get(id);
            const item = FAQ_BY_ID.get(id);
            if (!entry || !item) return null;
            return (
              <div key={id} ref={index === history.length - 1 ? latestRef : undefined} className="space-y-2">
                <p className="ml-8 rounded-lg bg-cherenkov-blue-800 p-3 text-sm text-white dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink">{entry.question}</p>
                <div className="mr-5 rounded-lg border border-border bg-card p-3 text-sm">
                  <p className="whitespace-pre-wrap">{entry.answer}</p>
                  {item.links?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.links.map((key) => (
                        <Link key={key} href={FAQ_LINKS[key]} onClick={onNavigate} className={linkChip}>
                          {t(`faq.links.${key}`)}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {followUps.length > 0 && !showAll ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t("faq.alsoAsk")}</h3>
              <ul className="space-y-2">
                {followUps.map((id) => (
                  <li key={id}>
                    <button type="button" onClick={() => pick(id)} className={questionButton}>{byId.get(id)?.question}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll} className={pillButton}>
              {showAll ? t("faq.hideAll") : t("faq.allQuestions")}
            </button>
            <button type="button" onClick={startOver} className={pillButton}>{t("faq.startOver")}</button>
          </div>
        </div>
      ) : null}

      {browsing ? list : null}
    </div>
  );
}

function isGroup(value: string): value is FaqGroup {
  return (FAQ_GROUPS as readonly string[]).includes(value);
}
