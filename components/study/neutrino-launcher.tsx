"use client";

import { lazy, Suspense, useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { StudyTimer } from "@/components/study/study-timer";
import { ManifoldMascot, type MascotMood } from "@/components/study/manifold-mascot";
import { CompanionTrail } from "@/components/study/companion-trail";
import { NtIcon, NtStyleProvider } from "@/components/study/nt-icon";
import { NeutrinoGlyph, type GlyphKind } from "@/components/study/neutrino-glyph";
import { CompanionPreferences } from "@/components/study/companion-preferences";
import { NeutrinoFaq } from "@/components/study/neutrino-faq";
import { NeutrinoChatList } from "@/components/study/neutrino-chat-list";
import { ChatMeter } from "@/components/study/chat-meter";
import { useChatList } from "@/components/study/use-chat-list";
import { useOwnKey } from "@/components/study/use-own-key";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { cancelAllAnimations, useCompanionWander } from "@/components/study/use-companion-wander";
import {
  COMPANION_DAILY_LIMIT,
  COMPANION_MAX_CHATS,
  COMPANION_MAX_CHAT_MESSAGES,
  COMPANION_MAX_HISTORY,
  COMPANION_MAX_MESSAGE_CHARS,
  COMPANION_PERSONAL_DAILY_LIMIT,
  COMPANION_SIZE_PX,
  DEFAULT_COMPANION_PREFS,
  DEFAULT_DRIFT_SPEED,
  type CompanionStyle,
} from "@/lib/companion-settings";
import { pageRefFromPath } from "@/lib/companion-prompt";
import {
  DEFAULT_DOCK_POSITION,
  DOCK_MARGIN,
  MIN_PANEL_SIZE,
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
type ChatError = "chat_limit" | "chat_full" | "chat_conflict" | "chat_not_found" | "personal_limit" | "ai_disabled" | "acknowledgement_required" | "cherenkov_limit" | "provider_quota" | "provider_unavailable" | "configuration" | "personal_key" | "personal_quota" | "personal_unavailable" | "unauthenticated" | "unavailable" | "unknown";

// Markdown and KaTeX load only when a chat message is shown, so neither the
// renderer nor katex.css is part of the page's own bundle.
const NeutrinoMarkdown = lazy(() => import("@/components/study/neutrino-markdown"));

function ChatText({ text }: { text: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
      <NeutrinoMarkdown text={text} />
    </Suspense>
  );
}

const POSITION_KEY = "neutrino-position-v1";
const HIDDEN_KEY = "neutrino-hidden-v1";
const INTRO_KEY = "neutrino-intro-dismissed-v1";
const INTRO_VISIBLE_MS = 6000;
// How much horizontal room the intro bubble needs beside the mascot (its width
// plus the gap and a margin from the screen edge).
const INTRO_ROOM_PX = 230;
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

function CompanionPanel({
  name,
  signedIn,
  aiEnabled,
  aiAcknowledged,
  aiBannerDismissed = false,
  faqBannerDismissed = false,
  onDismissAiBanner,
  onDismissFaqBanner,
  mode,
  setMode,
  onRequestAi,
  aiNoticeOpen,
  onCloseAiNotice,
  onAcknowledgeAi,
  close,
  onNavigate,
  embedded = false,
  messages,
  setMessages,
  chatId,
  setChatId,
  chatStyle,
  onActivity,
  busy,
  setBusy,
  mascot,
  openFloating,
  floatingUnsupported = false,
  onResetPosition,
  onResetPanelSize,
  onResetAll,
  onHideUntilReload,
}: {
  name: string;
  signedIn: boolean;
  aiEnabled: boolean;
  aiAcknowledged: boolean;
  aiBannerDismissed?: boolean;
  faqBannerDismissed?: boolean;
  onDismissAiBanner?: () => void;
  onDismissFaqBanner?: () => void;
  mode: AnswerMode;
  setMode: (mode: AnswerMode) => void;
  onRequestAi: () => void;
  aiNoticeOpen: boolean;
  onCloseAiNotice: () => void;
  onAcknowledgeAi: () => Promise<void>;
  close: () => void;
  onNavigate?: () => void;
  embedded?: boolean;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  chatId: string | null;
  setChatId: Dispatch<SetStateAction<string | null>>;
  chatStyle: CompanionStyle;
  /** Tells the mascot what the panel is doing, so it can show a glyph. */
  onActivity?: (activity: { tab: "ask" | "timer" | "settings"; error: boolean }) => void;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  mascot: MascotMood;
  openFloating?: () => void;
  floatingUnsupported?: boolean;
  onResetPosition?: () => void;
  onResetPanelSize?: () => void;
  onResetAll?: () => void;
  onHideUntilReload?: () => void;
}) {
  const t = useTranslations("companion");
  const [tab, setTab] = useState<"ask" | "timer" | "settings">("ask");
  const pixel = chatStyle === "pixel";
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [keyConsent, setKeyConsent] = useState(false);
  const [noticeChecked, setNoticeChecked] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [chatListOpen, setChatListOpen] = useState(false);
  // How many messages the open chat holds on the server (the thread on screen
  // can hold unsaved turns from a failed request).
  const [savedCount, setSavedCount] = useState(0);
  const { key: ownKey, setKey: setOwnKey, clear: clearOwnKey } = useOwnKey();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatList = useChatList(signedIn && aiEnabled && mode === "ai");
  const listUsage = chatList.state.status === "ready" ? chatList.state.usage : null;
  const hasError = error !== null;
  useEffect(() => {
    onActivity?.({ tab, error: hasError });
  }, [tab, hasError, onActivity]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const chatsAtMax = (listUsage?.chats ?? 0) >= COMPANION_MAX_CHATS;
  const chatFull = chatId !== null && savedCount + 2 > COMPANION_MAX_CHAT_MESSAGES;
  const newChatBlocked = chatId === null && chatsAtMax;
  const composerBlocked = chatFull || newChatBlocked;
  const limitValues = { max: COMPANION_MAX_CHAT_MESSAGES, maxChats: COMPANION_MAX_CHATS, maxMessages: COMPANION_MAX_CHAT_MESSAGES, limit: COMPANION_DAILY_LIMIT, personalLimit: COMPANION_PERSONAL_DAILY_LIMIT };

  function newChat() {
    setMessages([]);
    setChatId(null);
    setSavedCount(0);
    setTruncated(false);
    setError(null);
    setChatListOpen(false);
  }

  async function openChat(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/companion/chats/${id}`, { cache: "no-store" });
      const data: { messages?: unknown } = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.messages)) throw new Error("open failed");
      const loaded = data.messages.filter(
        (m): m is Message => typeof m === "object" && m !== null && ((m as Message).role === "user" || (m as Message).role === "model") && typeof (m as Message).text === "string",
      );
      setMessages(loaded);
      setChatId(id);
      setSavedCount(loaded.length);
      setTruncated(false);
      setChatListOpen(false);
    } catch {
      setError("chat_not_found");
    }
  }

  async function deleteChat(id: string) {
    try {
      await fetch(`/api/companion/chats/${id}`, { method: "DELETE" });
    } finally {
      if (id === chatId) newChat();
      await chatList.refresh();
    }
  }

  async function send(options: { retry?: boolean; text?: string; key?: string } = {}) {
    const retry = options.retry === true;
    const latest = messages[messages.length - 1];
    const text = retry ? (latest?.role === "user" ? latest.text : "") : (options.text ?? draft).trim();
    if (!text || busy || !signedIn || !aiEnabled || composerBlocked) return;
    const all: Message[] = retry ? messages : [...messages, { role: "user", text }];
    if (!retry) {
      setMessages(all);
      setDraft("");
    }
    setBusy(true);
    setError(null);
    setTruncated(false);
    const key = options.key ?? ownKey;
    const page = pageRefFromPath(pathname);
    try {
      const response = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          messages: all.slice(-COMPANION_MAX_HISTORY),
          ...(chatId ? { chatId } : {}),
          ...(page ? { page } : {}),
          ...(key ? { personalKey: key, personalKeyConsent: true } : {}),
        }),
      });
      const data: { reply?: unknown; error?: unknown; chatId?: unknown; truncated?: unknown } = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = isChatError(data.error) ? data.error : "unknown";
        setError(code);
        // A rejected personal key is cleared, so it is not sent again.
        if (code === "personal_key") clearOwnKey();
        if (code === "chat_full") setSavedCount(COMPANION_MAX_CHAT_MESSAGES);
        if (code === "chat_limit") void chatList.refresh();
        if (code === "chat_conflict" && chatId) void openChat(chatId);
        if (code === "chat_not_found") { setChatId(null); setSavedCount(0); }
        return;
      }
      if (typeof data.reply !== "string") {
        setError("unknown");
        return;
      }
      setMessages([...all, { role: "model", text: data.reply }]);
      setSavedCount((count) => (chatId ? count : 0) + 2);
      if (typeof data.chatId === "string") setChatId(data.chatId);
      setTruncated(data.truncated === true);
      void chatList.refresh();
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
    }
  }

  function saveKeyAndRetry() {
    if (!keyConsent || !keyDraft.trim()) return;
    const key = keyDraft.trim();
    setOwnKey(key);
    setKeyDraft("");
    setKeyConsent(false);
    void send({ retry: true, key });
  }

  const statusText = tab !== "ask" ? t("subtitle") : pixel ? (mode === "ai" && aiEnabled ? t("statusAi") : t("statusFaq")) : mode === "ai" && aiEnabled ? t("subtitleAi") : t("subtitleFaq");
  const canTryPersonalKey = !ownKey && (error === "provider_quota" || error === "provider_unavailable" || error === "configuration" || error === "cherenkov_limit");

  return (
    // The outer box is the size container the compact tiers in globals.css
    // query. It never scrolls itself, so the AI notice can overlay it; the inner
    // .nt-panel scrolls as a last resort when even the tight tier cannot fit.
    <NtStyleProvider value={chatStyle}>
    <div className={`nt-container relative ${embedded ? "h-full" : "h-screen"}`}>
    <div data-style={chatStyle} className={`nt-panel ${pixel ? "nt-pixel" : ""} flex h-full flex-col overflow-y-auto bg-background text-foreground`}>
      <header className="nt-header flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="nt-avatar nt-frame flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <ManifoldMascot size={36} mood={mascot} lite />
          </span>
          <div className="nt-title min-w-0">
            <p className="nt-font truncate text-sm font-semibold">{name}</p>
            <p role={pixel ? "status" : undefined} title={statusText} className="nt-font nt-status text-xs text-muted-foreground">
              {statusText}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {openFloating ? (
            <button type="button" onClick={openFloating} className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("openFloating")} title={t("openFloating")}>
              <NtIcon name="external" className="h-4 w-4" />
              <span className="hidden min-[360px]:inline">{t("floatingShort")}</span>
            </button>
          ) : null}
          <button type="button" onClick={close} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label={t("close")}>
            <NtIcon name="close" className="h-4 w-4" />
          </button>
        </div>
      </header>

      {floatingUnsupported ? <p role="status" className="nt-frame shrink-0 border-b border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("unsupported")}</p> : null}

      <nav aria-label={t("tools")} className="nt-tabs grid shrink-0 grid-cols-3 gap-1 border-b border-border p-2">
        <button type="button" onClick={() => setTab("ask")} aria-pressed={tab === "ask"} className={tabClass(tab === "ask")}>
          <NtIcon name="ask" className="h-4 w-4" /> {t("askTab")}
        </button>
        <button type="button" onClick={() => setTab("timer")} aria-pressed={tab === "timer"} className={tabClass(tab === "timer")}>
          <NtIcon name="book" className="h-4 w-4" /> {t("timerTab")}
        </button>
        <button type="button" onClick={() => setTab("settings")} aria-pressed={tab === "settings"} className={tabClass(tab === "settings")}>
          <NtIcon name="settings" className="h-4 w-4" /> {t("settingsTab")}
        </button>
      </nav>

      {tab === "timer" ? (
        <div className="min-h-40 flex-1 overflow-y-auto p-4 [&_.text-7xl]:text-5xl [&_.space-y-6]:space-y-3">
          <StudyTimer signedIn={signedIn} subjects={[]} planItems={[]} showFocusView={false} />
        </div>
      ) : tab === "settings" ? (
        <div className="min-h-40 flex-1 overflow-y-auto p-4">
          <CompanionPreferences
            signedIn={signedIn}
            variant="compact"
            onResetPosition={onResetPosition}
            onResetPanelSize={onResetPanelSize}
            onResetAll={onResetAll}
            onHideUntilReload={onHideUntilReload}
          />
        </div>
      ) : null}
      {/* The Ask tab stays mounted while Timer or Settings is showing (the
          inactive tab is display:none, and "contents" keeps its children in the
          panel's flex column). Unmounting it on every switch threw away the
          whole FAQ conversation, search and group filter. */}
      <div className={tab === "ask" ? "contents" : "hidden"}>
        <>
          {aiEnabled ? (
            <div className="nt-bars shrink-0">
              <div className="nt-modebar border-b border-border p-2">
                <div role="group" aria-label={t("modeGroup")} className="nt-frame grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
                  <button type="button" onClick={() => setMode("faq")} aria-pressed={mode === "faq"} className={modeClass(mode === "faq")}>
                    <NtIcon name="help" className="h-4 w-4" /> {t("faqMode")}
                  </button>
                  <button type="button" onClick={onRequestAi} aria-pressed={mode === "ai"} className={modeClass(mode === "ai")}>
                    <NtIcon name="bot" className="h-4 w-4" /> {t("aiMode")}
                  </button>
                </div>
              </div>
              {mode === "ai" && signedIn ? (
                <div className="nt-chatbar flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                  <button type="button" onClick={() => setChatListOpen((open) => !open)} aria-pressed={chatListOpen} className="nt-btn inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 text-sm font-medium hover:bg-muted">
                    {t("chatsButton")}{listUsage ? ` (${listUsage.chats}/${COMPANION_MAX_CHATS})` : ""}
                  </button>
                  <button type="button" onClick={newChat} disabled={messages.length === 0 && chatId === null} className="nt-btn inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
                    {t("newChat")}
                  </button>
                  {chatId ? (
                    <div className="nt-meter min-w-[8rem] flex-1">
                      <ChatMeter label={t("messagesMeter", { count: savedCount, max: COMPANION_MAX_CHAT_MESSAGES })} value={savedCount} max={COMPANION_MAX_CHAT_MESSAGES} valueText={t("messagesMeter", { count: savedCount, max: COMPANION_MAX_CHAT_MESSAGES })} style={chatStyle} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "faq" || !aiEnabled ? (
            <NeutrinoFaq
              name={name}
              onNavigate={onNavigate}
              onSwitchToAi={aiEnabled ? onRequestAi : undefined}
              banner={
                !faqBannerDismissed ? (
                  <div role="status" className="nt-banner nt-frame relative flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5 pr-8 text-xs text-muted-foreground">
                    <NtIcon name="help" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">
                      {t("faqBanner")}
                      {!aiEnabled ? (
                        <>
                          {" "}{t("aiOffNote")}{" "}
                          <button type="button" onClick={() => setTab("settings")} className="underline underline-offset-2">{t("aiTurnOn")}</button>
                        </>
                      ) : null}
                    </span>
                    {onDismissFaqBanner ? (
                      <button
                        type="button"
                        onClick={onDismissFaqBanner}
                        aria-label={t("dismissFaqBanner")}
                        title={t("dismissFaqBanner")}
                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <NtIcon name="close" className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null
              }
            />
          ) : (
            <>
              {chatListOpen && signedIn ? (
                <NeutrinoChatList state={chatList.state} activeId={chatId} onOpen={(id) => void openChat(id)} onDelete={(id) => void deleteChat(id)} onNew={newChat} />
              ) : (
              <div ref={scrollRef} className="min-h-40 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
                {!aiBannerDismissed ? (
                  <div role="status" className="nt-banner nt-frame relative flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-2.5 pr-8 text-xs text-foreground">
                    <NtIcon name="bot" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{t("aiBanner")}</span>
                    {onDismissAiBanner ? (
                      <button
                        type="button"
                        onClick={onDismissAiBanner}
                        aria-label={t("dismissAiBanner")}
                        title={t("dismissAiBanner")}
                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-warning-border/40 hover:text-foreground"
                      >
                        <NtIcon name="close" className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!signedIn ? (
                  <div className="nt-frame rounded-lg border border-border bg-card p-4 text-sm">
                    <p className="font-medium">{t("signInTitle")}</p>
                    <p className="mt-1 text-muted-foreground">{t("signInBody")}</p>
                    <Link className="mt-3 inline-flex min-h-10 items-center underline underline-offset-4" href="/login">{t("signIn")}</Link>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="nt-frame rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{t("welcome")}</p>
                ) : null}
                {messages.map((message, index) => (
                  <div key={`${index}-${message.role}`}>
                    {messages.length > COMPANION_MAX_HISTORY && index === messages.length - COMPANION_MAX_HISTORY ? (
                      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <span aria-hidden="true" className="h-px flex-1 bg-border" />
                        <span>{t("contextDivider")}</span>
                        <span aria-hidden="true" className="h-px flex-1 bg-border" />
                      </div>
                    ) : null}
                  <div className={message.role === "user" ? "nt-bubble ml-8 rounded-lg bg-cherenkov-blue-800 p-3 text-sm text-white dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink" : "nt-bubble mr-5 rounded-lg border border-border bg-card p-3 text-sm"}>
                    <div data-nt-exempt><ChatText text={message.text} /></div>
                  </div>
                  </div>
                ))}
                {truncated && !busy ? (
                  <div role="status" className="nt-frame flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <span>{t("truncated")}</span>
                    <button type="button" onClick={() => void send({ text: t("continue") })} disabled={composerBlocked} className="min-h-11 rounded-md border border-border-strong px-3 font-medium hover:bg-muted disabled:opacity-50">{t("continue")}</button>
                  </div>
                ) : null}
                {busy ? <p className="text-sm text-muted-foreground">{t("thinking")}</p> : null}
                {error ? <div role="alert" className="nt-frame rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-foreground">{t(`errors.${error}`, limitValues)}</div> : null}
                {/* The composer footer is hidden in the tightest tier; this copy
                    (shown only there) keeps the daily limit and the Help link reachable. */}
                <div className="nt-foot-inline items-center justify-between text-xs text-muted-foreground">
                  <span>{ownKey ? t("usingOwnKey") : t("dailyLimit", { limit: COMPANION_DAILY_LIMIT })}</span>
                  <Link href="/docs/neutrino" className="underline underline-offset-2">{t("help")}</Link>
                </div>
              </div>
              )}

              {canTryPersonalKey && !chatListOpen ? (
                <form className="shrink-0 space-y-2 border-t border-border bg-muted/30 p-3" onSubmit={(event) => { event.preventDefault(); saveKeyAndRetry(); }}>
                  <p className="text-sm font-medium">{t("personalKeyTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("ownKeyHelp", limitValues)}</p>
                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={keyConsent} onChange={(event) => setKeyConsent(event.target.checked)} className="mt-0.5" />
                    <span>{t("ownKeyConsent")}</span>
                  </label>
                  <input type="password" aria-label={t("ownKeyPlaceholder")} autoComplete="off" spellCheck={false} maxLength={256} value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder={t("ownKeyPlaceholder")} className="h-10 w-full rounded-md border border-border-strong bg-background px-3 text-sm" />
                  <button type="submit" disabled={!keyConsent || !keyDraft.trim() || busy} className="h-10 w-full rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">{t("personalKeyUse")}</button>
                </form>
              ) : null}

              {composerBlocked ? (
                <div role="status" className="nt-frame shrink-0 space-y-2 border-t border-border bg-warning-bg p-3 text-sm">
                  <p>{chatFull && chatsAtMax ? t("chatFullAndLimitNotice", limitValues) : chatFull ? t("chatFullNotice", limitValues) : t("chatLimitNotice", limitValues)}</p>
                  {!chatFull || chatsAtMax ? (
                    <button type="button" onClick={() => setChatListOpen(true)} className="min-h-11 rounded-md border border-border-strong px-3 font-medium hover:bg-background">{t("openChatList")}</button>
                  ) : null}
                </div>
              ) : null}

              <form className="nt-composer sticky bottom-0 z-[1] shrink-0 border-t border-border bg-background p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
                <label htmlFor="neutrino-message" className="sr-only">{t("messageLabel")}</label>
                <div className="flex items-end gap-2">
                  <textarea id="neutrino-message" rows={2} maxLength={COMPANION_MAX_MESSAGE_CHARS} value={draft} disabled={!signedIn || busy || composerBlocked} onChange={(event) => setDraft(event.target.value)} placeholder={t("messagePlaceholder")} className="min-h-12 flex-1 resize-none rounded-md border border-border-strong bg-background px-3 py-2 text-sm" />
                  <button type="submit" disabled={!signedIn || busy || composerBlocked || !draft.trim()} className="h-11 rounded-md bg-cherenkov-blue-800 px-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink">{t("send")}</button>
                </div>
                <div className="nt-composer-foot mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ownKey ? t("usingOwnKey") : t("dailyLimit", { limit: COMPANION_DAILY_LIMIT })}</span>
                  <Link href="/docs/neutrino" className="underline underline-offset-2">{t("help")}</Link>
                </div>
              </form>
            </>
          )}
        </>
      </div>
    </div>
      {aiNoticeOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-background/90 p-4" role="dialog" aria-modal="true" aria-labelledby="neutrino-ai-notice-title">
          <div className="nt-frame nt-dialog w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-5 shadow-xl">
            <div>
              <h2 id="neutrino-ai-notice-title" className="text-base font-semibold">{t("aiNoticeTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("aiNoticeBody")}</p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={noticeChecked} onChange={(event) => setNoticeChecked(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
              <span>{t("aiNoticeConsent")}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCloseAiNotice} className="min-h-10 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">{t("cancel")}</button>
              <button type="button" onClick={() => void onAcknowledgeAi()} disabled={!noticeChecked} className="min-h-10 rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">{t("aiNoticeContinue")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </NtStyleProvider>
  );
}

// The draggable mascot plus the companion panel it opens. Works in the page,
// and the panel can be popped out into a floating window.
export function InPageNeutrino() {
  const t = useTranslations("companion");
  const pathname = usePathname();
  const { data: session } = useSession();
  const signedIn = Boolean(session);
  const { prefs, update: updatePrefs } = useCompanionPrefs(signedIn);
  const panelId = useId();
  const helpId = useId();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [resetMotion, setResetMotion] = useState(false);
  const [introVisible, setIntroVisible] = useState(false);
  // Which side of the mascot the intro bubble sits on: "left" puts the bubble to
  // the mascot's left (the natural choice for the default bottom-right corner).
  const [introSide, setIntroSide] = useState<"left" | "right">("left");
  const [openAnchor, setOpenAnchor] = useState<{ left: number; top: number } | null>(null);
  const [driftPaused, setDriftPaused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ tab: "ask" | "timer" | "settings"; error: boolean }>({ tab: "ask", error: false });
  const [busy, setBusy] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipRoot, setPipRoot] = useState<HTMLDivElement | null>(null);
  const [floatingUnsupported, setFloatingUnsupported] = useState(false);
  const [aiNoticeOpen, setAiNoticeOpen] = useState(false);

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
  const [pageMood, setPageMood] = useState<MascotMood>("idle");

  const dockRef = useRef<HTMLButtonElement>(null);
  const wanderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!introVisible) return;
    const timer = window.setTimeout(() => setIntroVisible(false), INTRO_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [introVisible]);

  // The mascot roams, so the side with room for the bubble changes. Look at where
  // it is on screen (not at its resting spot) and only switch sides once the
  // current side runs out of room, so the bubble does not flip back and forth.
  useEffect(() => {
    if (!introVisible || open) return undefined;
    const place = () => {
      const rect = dockRef.current?.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) return;
      const roomLeft = rect.left;
      const roomRight = window.innerWidth - rect.right;
      setIntroSide((current) => {
        if ((current === "left" ? roomLeft : roomRight) >= INTRO_ROOM_PX) return current;
        return roomLeft >= roomRight ? "left" : "right";
      });
    };
    place();
    const interval = window.setInterval(place, 200);
    return () => window.clearInterval(interval);
  }, [introVisible, open]);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; left: number; top: number; moved: boolean; last: { left: number; top: number } } | null>(null);
  const resizeRef = useRef<{ id: number; startX: number; startY: number; start: PanelFrame; edges: PanelEdge[]; last: PanelFrame } | null>(null);
  const suppressClickUntil = useRef(0);
  const restoreFocus = useRef(false);
  const previousPath = useRef(pathname);
  const driftTimer = useRef<number | null>(null);

  const size = COMPANION_SIZE_PX[prefs.size];
  const positionRef = useRef(position);
  positionRef.current = position;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const sheetOpenRef = useRef(false);
  const mood: MascotMood = busy ? "thinking" : open ? "curious" : pageMood;
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
    // The intro bubble shows ONCE. The dismissal is stored when it is first
    // shown (not only when it is clicked), and it hides itself after
    // INTRO_VISIBLE_MS, so a roaming dock never carries a speech bubble over the
    // text a first-time visitor is reading.
    try {
      const firstView = window.localStorage.getItem(INTRO_KEY) !== "1";
      setIntroVisible(firstView);
      if (firstView) window.localStorage.setItem(INTRO_KEY, "1");
    } catch { /* Keep the intro optional when storage is unavailable. */ }
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setPageMood("curious");
    const timeout = window.setTimeout(() => setPageMood("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

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
    if (!open && !pipWindow) return;
    if (driftTimer.current !== null) window.clearTimeout(driftTimer.current);
    driftTimer.current = null;
  }, [open, pipWindow]);

  useEffect(() => () => {
    if (driftTimer.current !== null) window.clearTimeout(driftTimer.current);
  }, []);

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
      pauseDriftForCooldown();
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
    setOpenAnchor(null);
    pauseDriftForCooldown();
  }

  function pauseDriftForCooldown() {
    setDriftPaused(true);
    if (driftTimer.current !== null) window.clearTimeout(driftTimer.current);
    driftTimer.current = window.setTimeout(() => {
      driftTimer.current = null;
      if (dragRef.current) return;
      setDriftPaused(false);
    }, 5_000);
  }

  function requestAi() {
    if (prefs.aiAcknowledged) {
      setMode("ai");
    } else {
      setAiNoticeOpen(true);
    }
  }

  async function acknowledgeAi() {
    const result = await updatePrefs({ aiAcknowledged: true });
    if (result === "error") return;
    setAiNoticeOpen(false);
    setMode("ai");
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
    const next = positionToPixels(DEFAULT_DOCK_POSITION, viewport, size);
    if (open) setOpenAnchor(next);
    resetDockMotion();
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

  function resetDockMotion() {
    setResetMotion(true);
    window.requestAnimationFrame(() => setResetMotion(false));
  }

  function resetAllLayout() {
    savePosition(DEFAULT_DOCK_POSITION);
    savePanelSize(null);
    try { window.localStorage.removeItem(INTRO_KEY); } catch { /* Defaults still apply for this visit. */ }
    setIntroVisible(true);
    writeSession(HIDDEN_KEY, null);
    writeSession(SLOW_KEY, null);
    setHiddenForNow(false);
    setFellBack(false);
    setDriftPaused(true);
    if (driftTimer.current !== null) window.clearTimeout(driftTimer.current);
    driftTimer.current = window.setTimeout(() => {
      driftTimer.current = null;
      setDriftPaused(false);
    }, 5_000);
    const next = positionToPixels(DEFAULT_DOCK_POSITION, viewport, COMPANION_SIZE_PX[DEFAULT_COMPANION_PREFS.size]);
    setOpenAnchor(next);
    resetDockMotion();
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
    // A click on a handle (or the first half of a double-click) must not freeze
    // the current, possibly screen-clamped, size as the student's chosen size.
    const changed = resize.last.width !== resize.start.width || resize.last.height !== resize.start.height;
    if (commit && changed) savePanelSize({ width: resize.last.width, height: resize.last.height });
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

  // Random wandering: offsets from the resting spot that keep it on screen.
  useCompanionWander({
    ref: wanderRef,
    enabled: showDock && !hiddenForNow && prefs.ambientMotion && !dragPx && !resetMotion,
    paused: driftPaused || open || Boolean(pipWindow),
    speed: prefs.driftSpeed ?? DEFAULT_DRIFT_SPEED,
    bounds: {
      minX: DOCK_MARGIN - basePx.left,
      maxX: viewport.width - size - DOCK_MARGIN - basePx.left,
      minY: DOCK_MARGIN - basePx.top,
      maxY: viewport.height - size - DOCK_MARGIN - basePx.top,
    },
    resetKey: [Math.round(basePx.left), Math.round(basePx.top), viewport.width, viewport.height, size].join("|"),
  });

  // The viewport at the moment of the gesture. The `viewport` state can be stale
  // (a mobile URL bar or a zoom change does not always fire resize in time).
  function liveViewport(): Viewport {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pauseDriftForCooldown();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const visualPosition = { left: rect.left, top: rect.top };
    // dragPx stays null until the pointer has travelled past the threshold (see
    // onPointerMove). Setting it here, as this used to, made every plain click
    // swap the dock from its on-screen spot to its resting spot (basePx) on
    // release, so a mascot that had wandered away jumped back to the corner.
    dragRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, ...visualPosition, moved: false, last: visualPosition };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // A small threshold keeps an ordinary click from nudging the mascot.
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      // The drag begins: drop every wander animation synchronously, in this very
      // event, so no leftover offset can sit under the left/top set below.
      cancelAllAnimations(wanderRef.current);
    }
    drag.moved = true;
    pauseDriftForCooldown();
    drag.last = clampPixels(drag.left + dx, drag.top + dy, liveViewport(), size);
    setDragPx(drag.last);
  }

  // Ends whatever drag is open. The last valid drag position is always kept, and
  // dragRef, dragPx and the drift cooldown are always cleared, whatever ended the
  // gesture: a release, a cancel, a lost capture, a blur or a hidden tab. A drag
  // left open would block the drift cooldown for the rest of the page view.
  function finishDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    pauseDriftForCooldown();
    if (!drag.moved) return;
    // The browser still fires a click after a drag; ignore it.
    suppressClickUntil.current = performance.now() + 300;
    const view = liveViewport();
    const last = clampPixels(drag.last.left, drag.last.top, view, size);
    savePosition(pixelsToPosition(last.left, last.top, view, size));
    if (open) setOpenAnchor({ left: last.left, top: last.top });
    resetDockMotion();
    setDragPx(null);
  }
  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    finishDrag();
  }

  useEffect(() => {
    const finish = () => finishDragRef.current();
    const onVisibility = () => { if (document.visibilityState === "hidden") finish(); };
    window.addEventListener("blur", finish);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", finish);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Visibility watchdog. The dock must be where the state says it is. If a stray
  // animation or transform has put it elsewhere (or collapsed it), cancel the
  // animations and force the transform off. It only runs where the Web
  // Animations API exists, and never while a wander leg legitimately offsets
  // the dock.
  function verifyDock(intended: { left: number; top: number }) {
    const el = wanderRef.current;
    if (!el || typeof el.getAnimations !== "function" || sheetOpenRef.current) return;
    if (getComputedStyle(el).display === "none") return;
    const rect = el.getBoundingClientRect();
    const off = Math.abs(rect.left - intended.left) > 4 || Math.abs(rect.top - intended.top) > 4;
    const collapsed = rect.width === 0 || rect.height === 0;
    if (!off && !collapsed) return;
    const cancelled = cancelAllAnimations(el);
    el.style.transform = "none";
    if (process.env.NODE_ENV !== "production") {
      console.warn("[neutrino] dock watchdog: rect disagreed with the intended position", { rect: rect.toJSON?.() ?? rect, intended, cancelled });
    }
  }
  const verifyDockRef = useRef(verifyDock);
  verifyDockRef.current = verifyDock;

  // During a drag: after every committed move, the dock must be under the pointer.
  useEffect(() => {
    if (dragPx) verifyDockRef.current(dragPx);
    else wanderRef.current?.style.removeProperty("transform");
  }, [dragPx]);

  // After a resize or a tab coming back to the front, a dock that is not
  // wandering must sit at its resting spot.
  useEffect(() => {
    const check = () => {
      const el = wanderRef.current;
      if (!el || dragRef.current || typeof el.getAnimations !== "function") return;
      if (el.getAnimations().length === 0) verifyDockRef.current(positionToPixels(positionRef.current, liveViewport(), sizeRef.current));
    };
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("resize", check);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    pauseDriftForCooldown();
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
    const rect = dockRef.current?.getBoundingClientRect();
    const currentX = rect && (rect.width > 0 || rect.height > 0) ? rect.left : basePx.left;
    const currentY = rect && (rect.width > 0 || rect.height > 0) ? rect.top : basePx.top;
    const view = liveViewport();
    const next = clampPixels(currentX + move[0], currentY + move[1], view, size);
    savePosition(pixelsToPosition(next.left, next.top, view, size));
    if (open) setOpenAnchor(next);
    resetDockMotion();
  }

  function onClick() {
    if (performance.now() < suppressClickUntil.current) return;
    if (introVisible) {
      setIntroVisible(false);
      try { window.localStorage.setItem(INTRO_KEY, "1"); } catch { /* Dismissed for this visit. */ }
    }
    pauseDriftForCooldown();
    if (open) closePanel();
    else {
      const rect = dockRef.current?.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        setOpenAnchor({ left: rect.left, top: rect.top });
      }
      setOpen(true);
    }
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

  const panelAnchor = dragPx ?? openAnchor ?? px;
  const placement = open ? placePanel({ ...panelAnchor, size }, viewport, panelSize ?? {}) : null;
  const sheetOpen = placement?.mode === "sheet";
  sheetOpenRef.current = sheetOpen;
  const frame: PanelFrame | null = placement?.mode === "floating" ? (liveFrame ?? placement) : null;

  // Pixel punctuation beside the mascot (pixel style only). Decorative: the
  // panel's status text stays authoritative.
  const glyph: GlyphKind | null =
    prefs.style !== "pixel" || !open ? null
    : busy ? "dots"
    : activity.error ? "alert"
    : activity.tab === "ask" && mode === "ai" && aiEnabled && signedIn ? "question"
    : null;

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
          <div className={`${prefs.style === "pixel" ? "nt-shell nt-unfold " : ""}h-full overflow-hidden rounded-xl border border-border bg-background shadow-2xl`}>
            <CompanionPanel
              name={prefs.name}
              signedIn={signedIn}
              aiEnabled={aiEnabled}
              aiAcknowledged={prefs.aiAcknowledged}
              aiBannerDismissed={prefs.aiBannerDismissed}
              faqBannerDismissed={prefs.faqBannerDismissed}
              onDismissAiBanner={() => void updatePrefs({ aiBannerDismissed: true })}
              onDismissFaqBanner={() => void updatePrefs({ faqBannerDismissed: true })}
              mode={mode}
              setMode={setMode}
              onRequestAi={requestAi}
              aiNoticeOpen={aiNoticeOpen}
              onCloseAiNotice={() => setAiNoticeOpen(false)}
              onAcknowledgeAi={acknowledgeAi}
              close={closePanel}
              onNavigate={closePanel}
              embedded
              messages={messages}
              setMessages={setMessages}
              chatId={chatId}
              setChatId={setChatId}
              chatStyle={prefs.style}
              onActivity={setActivity}
              busy={busy}
              setBusy={setBusy}
              mascot={mood}
              openFloating={openFloating}
              floatingUnsupported={floatingUnsupported}
              onResetPosition={resetPosition}
              onResetPanelSize={placement.mode === "floating" ? () => savePanelSize(null) : undefined}
              onResetAll={resetAllLayout}
              onHideUntilReload={() => { closePanel(); hideUntilReload(); }}
            />
          </div>

          {placement.mode === "floating" && frame ? (
            <ResizeHandles
              frame={frame}
              freeHorizontal={placement.freeHorizontal}
              freeVertical={placement.freeVertical}
              viewport={viewport}
              pixel={prefs.style === "pixel"}
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
              aiAcknowledged={prefs.aiAcknowledged}
              aiBannerDismissed={prefs.aiBannerDismissed}
              faqBannerDismissed={prefs.faqBannerDismissed}
              onDismissAiBanner={() => void updatePrefs({ aiBannerDismissed: true })}
              onDismissFaqBanner={() => void updatePrefs({ faqBannerDismissed: true })}
              mode={mode}
              setMode={setMode}
              onRequestAi={requestAi}
              aiNoticeOpen={aiNoticeOpen}
              onCloseAiNotice={() => setAiNoticeOpen(false)}
              onAcknowledgeAi={acknowledgeAi}
              close={() => pipWindow.close()}
              messages={messages}
              setMessages={setMessages}
              chatId={chatId}
              setChatId={setChatId}
              chatStyle={prefs.style}
              onActivity={setActivity}
              busy={busy}
              setBusy={setBusy}
              mascot={mood}
            />,
            pipRoot,
          )
        : null}

      {showDock && !hiddenForNow ? (
        <CompanionTrail
          targetRef={dockRef}
          enabled={prefs.ambientMotion}
          active={!open && !pipWindow && (!driftPaused || Boolean(dragPx))}
        />
      ) : null}

      {showDock && !hiddenForNow ? (
        <div
          ref={wanderRef}
          role="region"
          aria-label={prefs.name}
          className="neutrino-dock group fixed z-50"
          data-dragging={dragPx ? "true" : "false"}
          data-ambient={prefs.ambientMotion ? "true" : "false"}
          data-paused={driftPaused ? "true" : "false"}
          data-open={open ? "true" : "false"}
          data-motion-reset={resetMotion ? "true" : "false"}
          hidden={sheetOpen}
          style={{ left: px.left, top: px.top, width: size, height: size }}
        >
          {introVisible && !open ? (
            <div className={`absolute top-1/2 z-10 -translate-y-1/2 ${introSide === "left" ? "right-full mr-3" : "left-full ml-3"}`}>
              <button type="button" onClick={onClick} className={`${prefs.style === "pixel" ? "nt-dock-pixel " : ""}whitespace-nowrap rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-lg`}>
                {t("introPrompt")}
              </button>
              <button
                type="button"
                onClick={() => { setIntroVisible(false); try { window.localStorage.setItem(INTRO_KEY, "1"); } catch { /* Dismissed for this visit. */ } }}
                aria-label={t("dismissIntro")}
                className={`${prefs.style === "pixel" ? "nt-dock-pixel " : ""}neutrino-focus absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground shadow`}
              >
                <NtIcon name="close" className="h-3 w-3" />
              </button>
            </div>
          ) : null}
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
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onFocus={pauseDriftForCooldown}
            onBlur={pauseDriftForCooldown}
            className="neutrino-plate neutrino-focus block h-full w-full cursor-grab touch-none rounded-full shadow-xl active:cursor-grabbing"
          >
            <ManifoldMascot
              size={size}
              mood={mood}
              rotation={use3d ? "3d" : "flat"}
              monitor={prefs.rotation === "auto" && use3d}
              onSlow={markSlow}
            />
          </button>
          {glyph ? <NeutrinoGlyph kind={glyph} /> : null}
          <span id={helpId} className="sr-only">{t("dragHelp")}</span>
          <button
            type="button"
            onClick={hideUntilReload}
            aria-label={t("hideNow")}
            title={t("hideNow")}
            className={`${prefs.style === "pixel" ? "nt-dock-pixel " : ""}neutrino-focus pointer-events-none absolute -right-3 -top-3 flex [@media(hover:none)]:hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground opacity-0 shadow transition-opacity before:absolute before:-right-2.5 before:-top-2.5 before:bottom-0 before:left-0 before:content-[''] focus-visible:pointer-events-auto focus-visible:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100`}
          >
            <NtIcon name="close" className="h-3.5 w-3.5" />
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
  return ["chat_limit", "chat_full", "chat_conflict", "chat_not_found", "personal_limit", "acknowledgement_required", "ai_disabled", "cherenkov_limit", "provider_quota", "provider_unavailable", "configuration", "personal_key", "personal_quota", "personal_unavailable", "unauthenticated", "unavailable"].includes(String(value));
}

function tabClass(active: boolean) {
  return ["nt-tab nt-font inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-medium sm:text-sm", active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"].join(" ");
}

function modeClass(active: boolean) {
  return [
    "nt-tab nt-font inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium",
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
  pixel,
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
  pixel: boolean;
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
        aria-valuemin={MIN_PANEL_SIZE.width}
        aria-valuemax={Math.max(MIN_PANEL_SIZE.width, viewport.width - 32)}
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
        aria-valuemin={MIN_PANEL_SIZE.height}
        aria-valuemax={Math.max(MIN_PANEL_SIZE.height, viewport.height - 32)}
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
        <span className={pixel ? "" : `inline-flex ${backslash ? "rotate-45" : "-rotate-45"}`}><NtIcon name="grip" style={pixel ? "pixel" : "smooth"} className="h-4 w-4" /></span>
      </div>
    </>
  );
}
