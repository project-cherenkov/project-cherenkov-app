"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/routing";
import { searchEntries, type SearchEntry } from "@/lib/search";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: SearchEntry[] }
  | { status: "error" };

// Site search (R6). Opens from the header button or Ctrl/Cmd+K. The index (a
// static JSON file built from the content) is fetched the first time the
// dialog opens, then every query is scored in the browser: nothing typed is
// ever sent to a server.
//
// Accessibility: the input is a combobox controlling a listbox, with
// aria-activedescendant for the highlighted result, Up/Down to move, Enter to
// open, Escape to close (Radix Dialog supplies focus trapping and return).
export function SearchPalette() {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K toggles the palette from anywhere on the site.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const load = useCallback(() => {
    setState((current) => (current.status === "idle" || current.status === "error" ? { status: "loading" } : current));
    fetch(`/api/search-index/${locale}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<SearchEntry[]>;
      })
      .then((entries) => setState({ status: "ready", entries }))
      .catch(() => setState({ status: "error" }));
  }, [locale]);

  useEffect(() => {
    if (open && state.status === "idle") load();
  }, [open, state.status, load]);

  // A new locale means a different index.
  useEffect(() => {
    setState({ status: "idle" });
  }, [locale]);

  const hits = useMemo(
    () => (state.status === "ready" ? searchEntries(state.entries, query) : []),
    [state, query],
  );

  function go(entry: SearchEntry) {
    setOpen(false);
    router.push(entry.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((prev) => (hits.length === 0 ? 0 : (prev + 1) % hits.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((prev) => (hits.length === 0 ? 0 : (prev - 1 + hits.length) % hits.length));
    } else if (event.key === "Enter" && hits[active]) {
      event.preventDefault();
      go(hits[active].entry);
    }
  }

  const trimmed = query.trim();
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border p-2 text-muted-foreground hover:bg-card hover:text-foreground"
      >
        <Search className="h-4 w-4" aria-hidden />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setActive(0);
          }
        }}
      >
        <DialogContent
          className="top-24 max-w-xl -translate-y-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>

          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-activedescendant={hits.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t("placeholder")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-cherenkov-blue-pastel"
          />

          <ul id={listId} role="listbox" aria-label={t("results")} className="mt-3 max-h-80 overflow-y-auto">
            {hits.map(({ entry }, index) => (
              <li
                key={entry.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(entry)}
                className={[
                  "cursor-pointer rounded-md px-3 py-2",
                  index === active ? "bg-muted" : "",
                ].join(" ")}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-foreground">{entry.title}</span>
                  <span className="label-code shrink-0">
                    {t(`kinds.${entry.kind}`)}
                    {entry.subject ? ` · ${entry.subject}` : ""}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                  {entry.summary}
                </span>
              </li>
            ))}
          </ul>

          {/* One polite live region announces the state, not every keystroke. */}
          <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">
            {state.status === "loading" ? t("loading") : null}
            {state.status === "error" ? t("error") : null}
            {state.status === "ready" && trimmed && hits.length === 0 ? t("noResults", { query: trimmed }) : null}
            {state.status === "ready" && trimmed && hits.length > 0 ? t("resultCount", { count: hits.length }) : null}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
