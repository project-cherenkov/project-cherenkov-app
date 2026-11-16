"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { useEffect, useState } from "react";

const READ_KEY_PREFIX = "updates-read-v1:";
const READ_EVENT = "updates-read";

/** Records the latest update as read; every `useUnreadUpdates` listens for the event. */
export function markUpdatesRead(userId?: string, latestUpdateDate?: string) {
  if (!userId || !latestUpdateDate) return;
  try {
    window.localStorage.setItem(`${READ_KEY_PREFIX}${userId}`, latestUpdateDate);
    window.dispatchEvent(new Event(READ_EVENT));
  } catch {
    // The updates page will retry marking the news as read after navigation.
  }
}

/** True when the signed-in reader has updates they have not opened yet. */
export function useUnreadUpdates(latestUpdateDate?: string) {
  const { data: session } = useSession();
  const signedIn = Boolean(session);
  const { prefs } = useCompanionPrefs(signedIn);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !latestUpdateDate) {
      setUnread(false);
      return;
    }
    try {
      const readAt = window.localStorage.getItem(`${READ_KEY_PREFIX}${session.user.id}`);
      setUnread(!readAt || readAt < latestUpdateDate);
    } catch {
      setUnread(true);
    }
  }, [latestUpdateDate, session?.user?.id]);

  useEffect(() => {
    const onRead = () => setUnread(false);
    window.addEventListener(READ_EVENT, onRead);
    return () => window.removeEventListener(READ_EVENT, onRead);
  }, []);

  return signedIn && prefs.updatesEnabled && unread;
}

export function UpdatesBell({
  latestUpdateDate,
  className = "inline-flex",
}: {
  latestUpdateDate?: string;
  /** Display utilities. The header hides the bell below `sm` (it moves into the drawer). */
  className?: string;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { data: session } = useSession();
  const hasUnread = useUnreadUpdates(latestUpdateDate);

  return (
    <Link
      href="/updates"
      locale={locale}
      onClick={() => markUpdatesRead(session?.user?.id, latestUpdateDate)}
      aria-label={hasUnread ? `${t("updates")}: ${t("unreadUpdates")}` : t("updates")}
      title={t("updates")}
      className={`relative h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}
    >
      <Bell className="h-4 w-4" aria-hidden />
      {hasUnread ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" aria-hidden />
      ) : null}
    </Link>
  );
}
