"use client";

import { Bell } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { useCompanionPrefs } from "@/components/study/use-companion-prefs";
import { useEffect, useState } from "react";

const READ_KEY_PREFIX = "updates-read-v1:";
const READ_EVENT = "updates-read";

export function UpdatesBell({ latestUpdateDate }: { latestUpdateDate?: string }) {
  const t = useTranslations("nav");
  const locale = useLocale();
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

  function markRead() {
    if (!session?.user?.id || !latestUpdateDate) return;
    try {
      window.localStorage.setItem(`${READ_KEY_PREFIX}${session.user.id}`, latestUpdateDate);
      setUnread(false);
      window.dispatchEvent(new Event(READ_EVENT));
    } catch {
      // The updates page will retry marking the news as read after navigation.
    }
  }

  return (
    <Link
      href="/updates"
      locale={locale}
      onClick={markRead}
      aria-label={unread ? `${t("updates")}: ${t("unreadUpdates")}` : t("updates")}
      title={t("updates")}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {signedIn && prefs.updatesEnabled && unread ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" aria-hidden />
      ) : null}
    </Link>
  );
}
