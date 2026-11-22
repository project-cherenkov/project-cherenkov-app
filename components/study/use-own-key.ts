"use client";

import { useCallback, useEffect, useState } from "react";

// The student's own Gemini key. It lives in sessionStorage only: it disappears
// when the tab closes, and it is never written to localStorage, the database or
// any log. Every surface (the panel, its Settings tab, the account page) reads
// it through this hook and stays in sync through one window event.
const STORAGE_KEY = "neutrino-own-key-v1";
const CHANGE_EVENT = "neutrino-own-key-changed";

function read(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useOwnKey() {
  const [key, setKeyState] = useState("");

  useEffect(() => {
    setKeyState(read());
    const onChange = () => setKeyState(read());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setKey = useCallback((value: string) => {
    const trimmed = value.trim();
    try {
      if (trimmed) window.sessionStorage.setItem(STORAGE_KEY, trimmed);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Blocked storage: the key lasts only until the next render.
    }
    setKeyState(trimmed);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const clear = useCallback(() => setKey(""), [setKey]);
  return { key, setKey, clear };
}
