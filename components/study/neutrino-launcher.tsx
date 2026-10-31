"use client";

import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { BookOpen, ExternalLink, MessageCircle, Settings2, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { StudyTimer } from "@/components/study/study-timer";
import { ManifoldMascot, type MascotMood } from "@/components/study/manifold-mascot";
import { CompanionPreferences } from "@/components/study/companion-preferences";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { COMPANION_SIZE_PX } from "@/lib/companion-settings";
import {
  DEFAULT_DOCK_POSITION,
  clampPixels,
  parseStoredPosition,
  pixelsToPosition,
  placePanel,
  positionToPixels,
  type DockPosition,
  type Viewport,
} from "@/lib/companion-position";

type CompanionWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  };
};

type Message = { role: "user" | "model"; text: string };
type ChatError = "cherenkov_limit" | "provider_quota" | "provider_unavailable" | "configuration" | "personal_key" | "personal_quota" | "personal_unavailable" | "unauthenticated" | "unavailable" | "unknown";

const POSITION_KEY = "neutrino-position-v1";
const HIDDEN_KEY = "neutrino-hidden-v1";
const SLOW_KEY = "neutrino-3d-slow-v1";

function copyStyles(source: Document, target: Document) {
  source.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });
  target.documentElement.className = source.documentElement.className;
  target.body.className = source.body.className;
}

function readSession(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Blocked storage: the choice simply lasts until the next render.
  }
}

function CompanionPanel({ name, signedIn, close, embedded = false, messages, setMessages, busy, setBusy, mascot, openFloating, floatingUnsupported = false, onResetPosition, onHideUntilReload }: {
  name: string;
  signedIn: boolean;
  close: () => void;
  embedded?: boolean;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  mascot: MascotMood;
  openFloating?: () => void;
  floatingUnsupported?: boolean;
  onResetPosition?: () => void;
  onHideUntilReload?: () => void;
}) {
  const t = useTranslations("companion");
  const [tab, setTab] = useState<"chat" | "timer" | "settings">("chat");
  const [draft, setDraft] = useState("");
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
    const userMessage: Message = { role: "user", text };
    const next: Message[] = usePersonalKey
      ? messages.slice(-6)
      : [...messages, userMessage].slice(-6);
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
      const data: { reply?: unknown; error?: unknown } = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(isChatError(data.error) ? data.error : "unknown");
        return;
      }
      if (typeof data.reply !== "string") {
        setError("unknown");
        return;
      }
      const modelMessage: Message = { role: "model", text: data.reply };
      const updated = [...next, modelMessage].slice(-6);
      setMessages(updated);
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <ManifoldMascot size={36} mood={mascot} lite />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {openFloating ? (
            <button type="button" onClick={openFloating} className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("openFloating")} title={t("openFloating")}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              <span className="hidden min-[360px]:inline">{t("floatingShort")}</span>
            </button>
          ) : null}
          <button type="button" onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {floatingUnsupported ? <p role="status" className="border-b border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("unsupported")}</p> : null}

      <nav aria-label={t("tools")} className="grid grid-cols-3 gap-1 border-b border-border p-2">
        <button type="button" onClick={() => setTab("chat")} aria-pressed={tab === "chat"} className={tabClass(tab === "chat")}>
          <MessageCircle className="h-4 w-4" aria-hidden /> {t("chatTab")}
        </button>
        <button type="button" onClick={() => setTab("timer")} aria-pressed={tab === "timer"} className={tabClass(tab === "timer")}>
          <BookOpen className="h-4 w-4" aria-hidden /> {t("timerTab")}
        </button>
        <button type="button" onClick={() => setTab("settings")} aria-pressed={tab === "settings"} className={tabClass(tab === "settings")}>
          <Settings2 className="h-4 w-4" aria-hidden /> {t("settingsTab")}
        </button>
      </nav>

      {tab === "timer" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 [&_.text-7xl]:text-5xl [&_.space-y-6]:space-y-3">
          <StudyTimer signedIn={signedIn} subjects={[]} planItems={[]} showFocusView={false} />
        </div>
      ) : tab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <CompanionPreferences
            signedIn={signedIn}
            variant="compact"
            onResetPosition={onResetPosition}
            onHideUntilReload={onHideUntilReload}
          />
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

// The draggable mascot plus the companion panel it opens. Works in the page,
// and the panel can be popped out into a floating window.
export function InPageNeutrino() {
  const t = useTranslations("companion");
  const { data: session } = useSession();
  const signedIn = Boolean(session);
  const { prefs } = useCompanionPrefs(signedIn);
  const panelId = useId();
  const helpId = useId();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipRoot, setPipRoot] = useState<HTMLDivElement | null>(null);
  const [floatingUnsupported, setFloatingUnsupported] = useState(false);

  const [hiddenForNow, setHiddenForNow] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  const [position, setPosition] = useState<DockPosition>(DEFAULT_DOCK_POSITION);
  const [viewport, setViewport] = useState<Viewport>({ width: 1024, height: 768 });
  const [dragPx, setDragPx] = useState<{ left: number; top: number } | null>(null);

  const dockRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; left: number; top: number; moved: boolean; last: { left: number; top: number } } | null>(null);
  const suppressClickUntil = useRef(0);
  const restoreFocus = useRef(false);

  const size = COMPANION_SIZE_PX[prefs.size];
  const mood: MascotMood = busy ? "thinking" : "idle";
  const showDock = mounted && prefs.enabled;
  const use3d = prefs.rotation === "3d" || (prefs.rotation === "auto" && !fellBack);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = parseStoredPosition(window.localStorage.getItem(POSITION_KEY));
      if (stored) setPosition(stored);
    } catch {
      // Storage blocked: the default corner is used.
    }
    setHiddenForNow(readSession(HIDDEN_KEY) === "1");
    setFellBack(readSession(SLOW_KEY) === "1");
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Choosing "Automatic" again gives 3D another chance.
  useEffect(() => {
    if (prefs.rotation === "auto") return;
    setFellBack(false);
    writeSession(SLOW_KEY, null);
  }, [prefs.rotation]);

  useEffect(() => {
    if (!showDock || hiddenForNow) setOpen(false);
  }, [showDock, hiddenForNow]);

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
    if (pipWindow) pipWindow.document.title = prefs.name;
  }, [pipWindow, prefs.name]);

  // Move focus into the panel when it opens, and back to the mascot when it closes.
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      dockRef.current?.focus();
    }
  }, [open]);

  function closePanel() {
    restoreFocus.current = true;
    setOpen(false);
  }

  function savePosition(next: DockPosition) {
    setPosition(next);
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(next));
    } catch {
      // Not persisted; still applies for this page view.
    }
  }

  function resetPosition() {
    savePosition(DEFAULT_DOCK_POSITION);
  }

  function hideUntilReload() {
    writeSession(HIDDEN_KEY, "1");
    setHiddenForNow(true);
  }

  function showAgain() {
    writeSession(HIDDEN_KEY, null);
    setHiddenForNow(false);
  }

  function markSlow() {
    writeSession(SLOW_KEY, "1");
    setFellBack(true);
  }

  const basePx = positionToPixels(position, viewport, size);
  const px = dragPx ?? basePx;

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: basePx.left, top: basePx.top, moved: false, last: basePx };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // A small threshold keeps an ordinary click from nudging the mascot.
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    drag.last = clampPixels(drag.left + dx, drag.top + dy, viewport, size);
    setDragPx(drag.last);
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, commit: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    // The browser still fires a click after a drag; ignore it.
    suppressClickUntil.current = performance.now() + 300;
    if (commit) savePosition(pixelsToPosition(drag.last.left, drag.last.top, viewport, size));
    setDragPx(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 64 : 16;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const next = clampPixels(basePx.left + move[0], basePx.top + move[1], viewport, size);
    savePosition(pixelsToPosition(next.left, next.top, viewport, size));
  }

  function onClick() {
    if (performance.now() < suppressClickUntil.current) return;
    if (open) closePanel();
    else setOpen(true);
  }

  async function openFloating() {
    const api = window as CompanionWindow;
    if (!api.documentPictureInPicture?.requestWindow) {
      setFloatingUnsupported(true);
      return;
    }
    setFloatingUnsupported(false);
    try {
      const companionWindow = await api.documentPictureInPicture.requestWindow({ width: 380, height: 680 });
      companionWindow.document.title = prefs.name;
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

  const placement = open ? placePanel({ left: px.left, top: px.top, size }, viewport) : null;
  const sheetOpen = placement?.mode === "sheet";

  return (
    <>
      {showDock && !hiddenForNow && placement ? (
        <section
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={prefs.name}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closePanel();
            }
          }}
          className={
            placement.mode === "sheet"
              ? "fixed inset-x-2 bottom-2 z-50 h-[min(36rem,calc(100dvh-1rem))] overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus:outline-none"
              : "fixed z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus:outline-none"
          }
          style={placement.mode === "floating" ? { left: placement.left, top: placement.top, width: placement.width, height: placement.height } : undefined}
        >
          <CompanionPanel
            name={prefs.name}
            signedIn={signedIn}
            close={closePanel}
            embedded
            messages={messages}
            setMessages={setMessages}
            busy={busy}
            setBusy={setBusy}
            mascot={mood}
            openFloating={openFloating}
            floatingUnsupported={floatingUnsupported}
            onResetPosition={resetPosition}
            onHideUntilReload={() => { closePanel(); hideUntilReload(); }}
          />
        </section>
      ) : null}
      {pipWindow && pipRoot
        ? createPortal(
            <CompanionPanel
              name={prefs.name}
              signedIn={signedIn}
              close={() => pipWindow.close()}
              messages={messages}
              setMessages={setMessages}
              busy={busy}
              setBusy={setBusy}
              mascot={mood}
            />,
            pipRoot,
          )
        : null}

      {showDock && !hiddenForNow ? (
        <div
          className="neutrino-dock group fixed z-50"
          data-dragging={dragPx ? "true" : "false"}
          hidden={sheetOpen}
          style={{ left: px.left, top: px.top, width: size, height: size }}
        >
          <button
            ref={dockRef}
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={open ? panelId : undefined}
            aria-describedby={helpId}
            aria-label={`${prefs.name}: ${open ? t("closeInPage") : t("openInPage")}`}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endDrag(event, true)}
            onPointerCancel={(event) => endDrag(event, false)}
            className="neutrino-plate neutrino-focus block h-full w-full cursor-grab rounded-full shadow-xl active:cursor-grabbing"
          >
            <ManifoldMascot
              size={size}
              mood={mood}
              rotation={use3d ? "3d" : "flat"}
              monitor={prefs.rotation === "auto" && use3d}
              onSlow={markSlow}
            />
          </button>
          <span id={helpId} className="sr-only">{t("dragHelp")}</span>
          <button
            type="button"
            onClick={hideUntilReload}
            aria-label={t("hideNow")}
            title={t("hideNow")}
            className="neutrino-focus absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 shadow transition-opacity before:absolute before:-inset-2.5 before:content-[''] focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {mounted && prefs.enabled && hiddenForNow ? (
        <button
          type="button"
          onClick={showAgain}
          aria-label={t("showAgain")}
          title={t("showAgain")}
          className="neutrino-focus fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-lg"
        >
          <ManifoldMascot size={44} lite />
        </button>
      ) : null}
    </>
  );
}

function isChatError(value: unknown): value is ChatError {
  return ["cherenkov_limit", "provider_quota", "provider_unavailable", "configuration", "personal_key", "personal_quota", "personal_unavailable", "unauthenticated", "unavailable"].includes(String(value));
}

function tabClass(active: boolean) {
  return ["inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-medium sm:text-sm", active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"].join(" ");
}
