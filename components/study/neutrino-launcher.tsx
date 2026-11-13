"use client";

import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { BookOpen, Bot, CircleHelp, ExternalLink, GripHorizontal, MessageCircleQuestion, Settings2, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { StudyTimer } from "@/components/study/study-timer";
import { ManifoldMascot, type MascotMood } from "@/components/study/manifold-mascot";
import { CompanionPreferences } from "@/components/study/companion-preferences";
import { NeutrinoFaq } from "@/components/study/neutrino-faq";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { COMPANION_SIZE_PX } from "@/lib/companion-settings";
import {
  DEFAULT_DOCK_POSITION,
  clampPixels,
  keyboardResize,
  parseStoredPanelSize,
  parseStoredPosition,
  pixelsToPosition,
  placePanel,
  positionToPixels,
  resizeFrame,
  type DockPosition,
  type PanelEdge,
  type PanelFrame,
  type PanelSize,
  type Viewport,
} from "@/lib/companion-position";

type CompanionWindow = Window & {
  documentPictureInPicture?: {
    requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  };
};

type Message = { role: "user" | "model"; text: string };
type AnswerMode = "faq" | "ai";
type ChatError = "ai_disabled" | "cherenkov_limit" | "provider_quota" | "provider_unavailable" | "configuration" | "personal_key" | "personal_quota" | "personal_unavailable" | "unauthenticated" | "unavailable" | "unknown";

const POSITION_KEY = "neutrino-position-v1";
const HIDDEN_KEY = "neutrino-hidden-v1";
const SLOW_KEY = "neutrino-3d-slow-v1";
const PANEL_SIZE_KEY = "neutrino-panel-size-v1";

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

function CompanionPanel({ name, signedIn, aiEnabled, mode, setMode, close, onNavigate, embedded = false, messages, setMessages, busy, setBusy, mascot, openFloating, floatingUnsupported = false, onResetPosition, onResetPanelSize, onHideUntilReload }: {
  name: string;
  signedIn: boolean;
  aiEnabled: boolean;
  mode: AnswerMode;
  setMode: (mode: AnswerMode) => void;
  close: () => void;
  onNavigate?: () => void;
  embedded?: boolean;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  mascot: MascotMood;
  openFloating?: () => void;
  floatingUnsupported?: boolean;
  onResetPosition?: () => void;
  onResetPanelSize?: () => void;
  onHideUntilReload?: () => void;
}) {
  const t = useTranslations("companion");
  const [tab, setTab] = useState<"ask" | "timer" | "settings">("ask");
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
    if (!text || busy || !signedIn || !aiEnabled) return;
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
            <p className="text-xs text-muted-foreground">{tab !== "ask" ? t("subtitle") : mode === "ai" && aiEnabled ? t("subtitleAi") : t("subtitleFaq")}</p>
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
        <button type="button" onClick={() => setTab("ask")} aria-pressed={tab === "ask"} className={tabClass(tab === "ask")}>
          <MessageCircleQuestion className="h-4 w-4" aria-hidden /> {t("askTab")}
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
            onResetPanelSize={onResetPanelSize}
            onHideUntilReload={onHideUntilReload}
          />
        </div>
      ) : (
        <>
          <div className="space-y-2 border-b border-border p-2">
            {aiEnabled ? (
              <div role="group" aria-label={t("modeGroup")} className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
                <button type="button" onClick={() => setMode("faq")} aria-pressed={mode === "faq"} className={modeClass(mode === "faq")}>
                  <CircleHelp className="h-4 w-4" aria-hidden /> {t("faqMode")}
                </button>
                <button type="button" onClick={() => setMode("ai")} aria-pressed={mode === "ai"} className={modeClass(mode === "ai")}>
                  <Bot className="h-4 w-4" aria-hidden /> {t("aiMode")}
                </button>
              </div>
            ) : null}
            {mode === "ai" && aiEnabled ? (
              <p role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> <span>{t("aiBanner")}</span>
              </p>
            ) : (
              <p role="status" className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {t("faqBanner")}
                  {!aiEnabled ? (
                    <>
                      {" "}{t("aiOffNote")}{" "}
                      <button type="button" onClick={() => setTab("settings")} className="underline underline-offset-2">{t("aiTurnOn")}</button>
                    </>
                  ) : null}
                </span>
              </p>
            )}
          </div>

          {mode === "faq" || !aiEnabled ? (
            <NeutrinoFaq name={name} onNavigate={onNavigate} onSwitchToAi={aiEnabled ? () => setMode("ai") : undefined} />
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
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("dailyLimit")}</span>
                  <Link href="/docs/neutrino" className="underline underline-offset-2">{t("help")}</Link>
                </div>
              </form>
            </>
          )}
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
  // FAQ is always where the companion starts. The choice is kept while the
  // student stays on the site, but never saved: coming back opens the FAQ.
  const [mode, setMode] = useState<AnswerMode>("faq");
  // null = the default panel size. liveFrame is the panel while an edge is being dragged.
  const [panelSize, setPanelSize] = useState<PanelSize | null>(null);
  const [liveFrame, setLiveFrame] = useState<PanelFrame | null>(null);

  const dockRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; left: number; top: number; moved: boolean; last: { left: number; top: number } } | null>(null);
  const resizeRef = useRef<{ id: number; startX: number; startY: number; start: PanelFrame; edges: PanelEdge[]; last: PanelFrame } | null>(null);
  const suppressClickUntil = useRef(0);
  const restoreFocus = useRef(false);

  const size = COMPANION_SIZE_PX[prefs.size];
  const mood: MascotMood = busy ? "thinking" : "idle";
  const showDock = mounted && prefs.enabled;
  const aiEnabled = prefs.aiEnabled;
  const use3d = prefs.rotation === "3d" || (prefs.rotation === "auto" && !fellBack);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = parseStoredPosition(window.localStorage.getItem(POSITION_KEY));
      if (stored) setPosition(stored);
      const storedSize = parseStoredPanelSize(window.localStorage.getItem(PANEL_SIZE_KEY));
      if (storedSize) setPanelSize(storedSize);
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

  // Turning the AI off drops back to the FAQ, and turning it on again does not
  // silently put the student back in a mode that sends text to an AI service.
  useEffect(() => {
    if (!aiEnabled) setMode("faq");
  }, [aiEnabled]);

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

  function savePanelSize(next: PanelSize | null) {
    setPanelSize(next);
    try {
      if (next) window.localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(PANEL_SIZE_KEY);
    } catch {
      // Not persisted; the size still applies for this page view.
    }
  }

  function onResizeDown(event: PointerEvent<HTMLElement>, edges: PanelEdge[], frame: PanelFrame) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, start: frame, edges, last: frame };
    setLiveFrame(frame);
  }

  function onResizeMove(event: PointerEvent<HTMLElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.id !== event.pointerId) return;
    resize.last = resizeFrame(resize.start, resize.edges, event.clientX - resize.startX, event.clientY - resize.startY, viewport);
    setLiveFrame(resize.last);
  }

  function onResizeUp(event: PointerEvent<HTMLElement>, commit: boolean) {
    const resize = resizeRef.current;
    if (!resize || resize.id !== event.pointerId) return;
    resizeRef.current = null;
    setLiveFrame(null);
    if (commit) savePanelSize({ width: resize.last.width, height: resize.last.height });
  }

  function onResizeKey(event: KeyboardEvent<HTMLElement>, edge: PanelEdge, frame: PanelFrame) {
    const next = keyboardResize(frame, edge, event.key, event.shiftKey, viewport);
    if (!next) return;
    event.preventDefault();
    savePanelSize({ width: next.width, height: next.height });
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

  const placement = open ? placePanel({ left: px.left, top: px.top, size }, viewport, panelSize ?? {}) : null;
  const sheetOpen = placement?.mode === "sheet";
  const frame: PanelFrame | null = placement?.mode === "floating" ? (liveFrame ?? placement) : null;

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
              ? "fixed inset-x-2 bottom-2 z-50 h-[min(36rem,calc(100dvh-1rem))] focus:outline-none"
              : "fixed z-50 focus:outline-none"
          }
          style={frame ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height } : undefined}
        >
          <div className="h-full overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
            <CompanionPanel
              name={prefs.name}
              signedIn={signedIn}
              aiEnabled={aiEnabled}
              mode={mode}
              setMode={setMode}
              close={closePanel}
              onNavigate={closePanel}
              embedded
              messages={messages}
              setMessages={setMessages}
              busy={busy}
              setBusy={setBusy}
              mascot={mood}
              openFloating={openFloating}
              floatingUnsupported={floatingUnsupported}
              onResetPosition={resetPosition}
              onResetPanelSize={placement.mode === "floating" ? () => savePanelSize(null) : undefined}
              onHideUntilReload={() => { closePanel(); hideUntilReload(); }}
            />
          </div>

          {placement.mode === "floating" && frame ? (
            <ResizeHandles
              frame={frame}
              freeHorizontal={placement.freeHorizontal}
              freeVertical={placement.freeVertical}
              viewport={viewport}
              labels={{ width: t("resize.width"), height: t("resize.height"), corner: t("resize.corner"), hint: t("resize.hint") }}
              onDown={onResizeDown}
              onMove={onResizeMove}
              onUp={onResizeUp}
              onKey={onResizeKey}
              onReset={() => savePanelSize(null)}
            />
          ) : null}
        </section>
      ) : null}
      {pipWindow && pipRoot
        ? createPortal(
            <CompanionPanel
              name={prefs.name}
              signedIn={signedIn}
              aiEnabled={aiEnabled}
              mode={mode}
              setMode={setMode}
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
          role="region"
          aria-label={prefs.name}
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
  return ["ai_disabled", "cherenkov_limit", "provider_quota", "provider_unavailable", "configuration", "personal_key", "personal_quota", "personal_unavailable", "unauthenticated", "unavailable"].includes(String(value));
}

function tabClass(active: boolean) {
  return ["inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-medium sm:text-sm", active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"].join(" ");
}

function modeClass(active: boolean) {
  return [
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/60",
  ].join(" ");
}

// The drag handles of the floating panel. Only the two edges that face away
// from the mascot (and the corner between them) can be dragged, because the
// other two are attached to the mascot. They sit just outside the panel so
// they never cover its scrollbar or its buttons. Each edge is also a
// keyboard-operable separator: focus it and use the arrow keys.
function ResizeHandles({
  frame,
  freeHorizontal,
  freeVertical,
  viewport,
  labels,
  onDown,
  onMove,
  onUp,
  onKey,
  onReset,
}: {
  frame: PanelFrame;
  freeHorizontal: "left" | "right";
  freeVertical: "top" | "bottom";
  viewport: Viewport;
  labels: { width: string; height: string; corner: string; hint: string };
  onDown: (event: PointerEvent<HTMLElement>, edges: PanelEdge[], frame: PanelFrame) => void;
  onMove: (event: PointerEvent<HTMLElement>) => void;
  onUp: (event: PointerEvent<HTMLElement>, commit: boolean) => void;
  onKey: (event: KeyboardEvent<HTMLElement>, edge: PanelEdge, frame: PanelFrame) => void;
  onReset: () => void;
}) {
  const side = freeHorizontal === "left" ? "-left-3" : "-right-3";
  const end = freeVertical === "top" ? "-top-3" : "-bottom-3";
  // Top-left and bottom-right corners drag along the "\\" diagonal, the others along "/".
  const backslash = (freeHorizontal === "left") === (freeVertical === "top");
  const cornerCursor = backslash ? "cursor-nwse-resize" : "cursor-nesw-resize";
  const shared = "absolute z-10 touch-none rounded-full hover:bg-foreground/10 focus-visible:bg-foreground/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
  const bind = (edges: PanelEdge[]) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => onDown(event, edges, frame),
    onPointerMove: onMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => onUp(event, true),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => onUp(event, false),
    onDoubleClick: onReset,
    title: labels.hint,
  });
  return (
    <>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={labels.width}
        aria-valuemin={300}
        aria-valuemax={Math.max(300, viewport.width - 32)}
        aria-valuenow={Math.round(frame.width)}
        onKeyDown={(event) => onKey(event, freeHorizontal, frame)}
        {...bind([freeHorizontal])}
        className={`${shared} ${side} inset-y-6 w-3 cursor-ew-resize`}
      />
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={labels.height}
        aria-valuemin={320}
        aria-valuemax={Math.max(320, viewport.height - 32)}
        aria-valuenow={Math.round(frame.height)}
        onKeyDown={(event) => onKey(event, freeVertical, frame)}
        {...bind([freeVertical])}
        className={`${shared} ${end} inset-x-6 h-3 cursor-ns-resize`}
      />
      <div
        aria-hidden="true"
        {...bind([freeHorizontal, freeVertical])}
        className={`${shared} ${side} ${end} flex h-6 w-6 items-center justify-center text-muted-foreground ${cornerCursor}`}
      >
        <GripHorizontal className={`h-4 w-4 ${backslash ? "rotate-45" : "-rotate-45"}`} aria-hidden />
      </div>
    </>
  );
}
