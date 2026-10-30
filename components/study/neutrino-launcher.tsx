"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { BookOpen, ExternalLink, MessageCircle, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { StudyTimer } from "@/components/study/study-timer";

type CompanionWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  };
};

type Message = { role: "user" | "model"; text: string };
type ChatError = "cherenkov_limit" | "provider_quota" | "provider_unavailable" | "configuration" | "personal_key" | "personal_quota" | "personal_unavailable" | "unauthenticated" | "unavailable" | "unknown";

function copyStyles(source: Document, target: Document) {
  source.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });
  target.documentElement.className = source.documentElement.className;
  target.body.className = source.body.className;
}

function CompanionPanel({ name, signedIn, close, embedded = false, messages, setMessages, openFloating, floatingUnsupported = false }: {
  name: string;
  signedIn: boolean;
  close: () => void;
  embedded?: boolean;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  openFloating?: () => void;
  floatingUnsupported?: boolean;
}) {
  const t = useTranslations("companion");
  const [tab, setTab] = useState<"chat" | "timer">("chat");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [personalKey, setPersonalKey] = useState("");
  const [keyConsent, setKeyConsent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(usePersonalKey = false) {
    const latest = messages[messages.length - 1];
    const text = usePersonalKey ? (latest?.role === "user" ? latest.text : "") : draft.trim();
    if (!text || busy || !signedIn) return;
    const next = usePersonalKey ? messages.slice(-6) : [...messages, { role: "user" as const, text }].slice(-6);
    if (!usePersonalKey) {
      setMessages(next);
      setDraft("");
    }
    setBusy(true);
    setError(null);
    const key = usePersonalKey ? personalKey : "";
    try {
      const response = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          messages: next,
          ...(key ? { personalKey: key, personalKeyConsent: keyConsent } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(isChatError(data.error) ? data.error : "unknown");
        return;
      }
      setMessages([...next, { role: "model", text: data.reply }].slice(-6));
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
      if (usePersonalKey) {
        setPersonalKey("");
        setKeyConsent(false);
      }
    }
  }

  const canTryPersonalKey = error === "provider_quota" || error === "provider_unavailable" || error === "configuration";

  return (
    <div className={`flex ${embedded ? "h-full" : "h-screen"} flex-col bg-background text-foreground`}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cherenkov-blue-800 dark:bg-slate-800">
            <NeutrinoAvatar className="h-9 w-9" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {openFloating ? (
            <button type="button" onClick={openFloating} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("openFloating")} title={t("openFloating")}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              <span className="hidden min-[360px]:inline">{t("floatingShort")}</span>
            </button>
          ) : null}
          <button type="button" onClick={close} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {floatingUnsupported ? <p role="status" className="border-b border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("unsupported")}</p> : null}

      <nav aria-label={t("tools")} className="grid grid-cols-2 gap-1 border-b border-border p-2">
        <button type="button" onClick={() => setTab("chat")} aria-pressed={tab === "chat"} className={tabClass(tab === "chat")}>
          <MessageCircle className="h-4 w-4" aria-hidden /> {t("chatTab")}
        </button>
        <button type="button" onClick={() => setTab("timer")} aria-pressed={tab === "timer"} className={tabClass(tab === "timer")}>
          <BookOpen className="h-4 w-4" aria-hidden /> {t("timerTab")}
        </button>
      </nav>

      {tab === "timer" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 [&_.text-7xl]:text-5xl [&_.space-y-6]:space-y-3">
          <StudyTimer signedIn={signedIn} subjects={[]} planItems={[]} showFocusView={false} />
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {!signedIn ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm">
                <p className="font-medium">{t("signInTitle")}</p>
                <p className="mt-1 text-muted-foreground">{t("signInBody")}</p>
                <Link className="mt-3 inline-flex min-h-10 items-center underline underline-offset-4" href="/login">{t("signIn")}</Link>
              </div>
            ) : messages.length === 0 ? (
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{t("welcome")}</p>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={message.role === "user" ? "ml-8 rounded-lg bg-cherenkov-blue-800 p-3 text-sm text-white dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink" : "mr-5 rounded-lg border border-border bg-card p-3 text-sm"}>
                <p className="whitespace-pre-wrap">{message.text}</p>
              </div>
            ))}
            {busy ? <p className="text-sm text-muted-foreground">{t("thinking")}</p> : null}
            {error ? <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{t(`errors.${error}`)}</div> : null}
          </div>

          {canTryPersonalKey ? (
            <form className="space-y-2 border-t border-border bg-muted/30 p-3" onSubmit={(event) => { event.preventDefault(); void send(true); }}>
              <p className="text-sm font-medium">{t("personalKeyTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("personalKeyNotice")}</p>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={keyConsent} onChange={(event) => setKeyConsent(event.target.checked)} className="mt-0.5" />
                <span>{t("personalKeyConsent")}</span>
              </label>
              <input type="password" autoComplete="off" spellCheck={false} maxLength={256} value={personalKey} onChange={(event) => setPersonalKey(event.target.value)} placeholder={t("personalKeyPlaceholder")} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
              <button type="submit" disabled={!keyConsent || !personalKey.trim() || busy} className="h-10 w-full rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">{t("personalKeyRetry")}</button>
            </form>
          ) : null}

          <form className="border-t border-border p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <label htmlFor="neutrino-message" className="sr-only">{t("messageLabel")}</label>
            <div className="flex items-end gap-2">
              <textarea id="neutrino-message" rows={2} maxLength={1200} value={draft} disabled={!signedIn || busy} onChange={(event) => setDraft(event.target.value)} placeholder={t("messagePlaceholder")} className="min-h-12 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <button type="submit" disabled={!signedIn || busy || !draft.trim()} className="h-11 rounded-md bg-cherenkov-blue-800 px-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink">{t("send")}</button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{t("dailyLimit")}</span>
              <Link href="/docs/neutrino" className="underline underline-offset-2">{t("help")}</Link>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

// In-page companion for sites/browsers where the separate floating window is
// unavailable or when students prefer to keep the helper on the current page.
export function InPageNeutrino() {
  const t = useTranslations("companion");
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Neutrino");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipRoot, setPipRoot] = useState<HTMLDivElement | null>(null);
  const [floatingUnsupported, setFloatingUnsupported] = useState(false);

  useEffect(() => {
    if (!session) {
      setName("Neutrino");
      return;
    }
    fetch("/api/companion/settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { name?: string } | null) => {
        if (data?.name) setName(data.name);
      })
      .catch(() => undefined);
  }, [session]);

  useEffect(() => {
    const updateName = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next === "string" && next) setName(next);
    };
    window.addEventListener("neutrino-name-changed", updateName);
    return () => window.removeEventListener("neutrino-name-changed", updateName);
  }, []);

  useEffect(() => {
    if (!pipWindow) return;
    const onClose = () => {
      setPipWindow(null);
      setPipRoot(null);
    };
    pipWindow.addEventListener("pagehide", onClose);
    return () => pipWindow.removeEventListener("pagehide", onClose);
  }, [pipWindow]);

  useEffect(() => {
    if (pipWindow) pipWindow.document.title = name;
  }, [pipWindow, name]);

  async function openFloating() {
    const api = window as CompanionWindow;
    if (!api.documentPictureInPicture?.requestWindow) {
      setFloatingUnsupported(true);
      return;
    }
    setFloatingUnsupported(false);
    try {
      const companionWindow = await api.documentPictureInPicture.requestWindow({ width: 380, height: 680 });
      companionWindow.document.title = name;
      copyStyles(document, companionWindow.document);
      const root = companionWindow.document.createElement("div");
      root.id = "neutrino-root";
      root.className = "min-h-screen bg-background text-foreground";
      companionWindow.document.body.replaceChildren(root);
      setPipRoot(root);
      setPipWindow(companionWindow);
      setOpen(false);
    } catch {
      setFloatingUnsupported(true);
    }
  }

  return (
    <>
      {open ? (
        <section
          aria-label={name}
          className="fixed bottom-20 right-4 z-50 h-[min(40rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-background shadow-2xl sm:bottom-24"
        >
          <CompanionPanel
            name={name}
            signedIn={Boolean(session)}
            close={() => setOpen(false)}
            embedded
            messages={messages}
            setMessages={setMessages}
            openFloating={openFloating}
            floatingUnsupported={floatingUnsupported}
          />
        </section>
      ) : null}
      {pipWindow && pipRoot
        ? createPortal(
            <CompanionPanel
              name={name}
              signedIn={Boolean(session)}
              close={() => pipWindow.close()}
              messages={messages}
              setMessages={setMessages}
            />,
            pipRoot,
          )
        : null}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? t("closeInPage") : t("openInPage")}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-cherenkov-blue-800 shadow-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring dark:border-slate-900 dark:bg-cherenkov-blue-pastel"
      >
        <NeutrinoAvatar />
        <span className="sr-only">{open ? t("closeInPage") : t("openInPage")}</span>
      </button>
    </>
  );
}

function NeutrinoAvatar({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="27" ry="11" transform="rotate(-32 32 32)" fill="none" stroke="#EFFFFB" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="19" fill="#EFFFFB" stroke="#0B4C65" strokeWidth="2.5" />
      <path d="M18 26c5-7 22-10 29 2 4 8-2 18-12 20-10 2-21-4-21-12 0-4 1-7 4-10Z" fill="#8AD7FF" />
      <circle cx="27" cy="33" r="2.2" fill="#0B2436" />
      <circle cx="39" cy="33" r="2.2" fill="#0B2436" />
      <path d="M29 40c2 2 6 2 8 0" fill="none" stroke="#0B2436" strokeLinecap="round" strokeWidth="2" />
      <circle cx="53" cy="14" r="3.5" fill="#F5A9B8" stroke="#0B4C65" strokeWidth="1.5" />
      <path d="m17 16 1.4 3.6L22 21l-3.6 1.4L17 26l-1.4-3.6L12 21l3.6-1.4L17 16Z" fill="#EFFFFB" />
    </svg>
  );
}

function isChatError(value: unknown): value is ChatError {
  return ["cherenkov_limit", "provider_quota", "provider_unavailable", "configuration", "personal_key", "personal_quota", "personal_unavailable", "unauthenticated", "unavailable"].includes(String(value));
}

function tabClass(active: boolean) {
  return ["inline-flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-medium", active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"].join(" ");
}
