"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

const READ_KEY_PREFIX = "updates-read-v1:";
const READ_EVENT = "updates-read";

export function UpdatesReadMarker({ latestUpdateDate }: { latestUpdateDate?: string }) {
  const { data: session } = useSession();
  useEffect(() => {
    if (!session?.user?.id || !latestUpdateDate) return;
    try {
      window.localStorage.setItem(`${READ_KEY_PREFIX}${session.user.id}`, latestUpdateDate);
      window.dispatchEvent(new Event(READ_EVENT));
    } catch {
      // A blocked storage API should not prevent reading updates.
    }
  }, [latestUpdateDate, session?.user?.id]);
  return null;
}
