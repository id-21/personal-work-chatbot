"use client";

import { type UIMessage } from "ai";
import { useEffect, useRef } from "react";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Triggers the reflection agent when the chat session ends.
 * Fires on:
 *   1. 10 minutes of inactivity (no new messages)
 *   2. Page leave / tab close (sendBeacon)
 *
 * De-duplicated per chat via sessionStorage so it only fires once per session.
 */
export function useSessionEndTrigger(
  chatId: string,
  messages: UIMessage[]
) {
  const triggeredKey = `reflect-triggered-${chatId}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function trigger() {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(triggeredKey)) return;
    sessionStorage.setItem(triggeredKey, "1");

    navigator.sendBeacon(`/api/chat/${chatId}/reflect`);
  }

  // Reset inactivity timer whenever messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only depend on messages length and chatId
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(trigger, INACTIVITY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [messages.length, chatId]);

  // Fire on page leave
  useEffect(() => {
    function handleBeforeUnload() {
      trigger();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger is stable within this effect
  }, [chatId]);
}
