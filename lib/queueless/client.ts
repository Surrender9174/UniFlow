"use client";

import { supabase } from "@/lib/supabase";

const activeTicketStorageKey = "uniflow-queueless-active-ticket";
const activeTicketChangedEvent = "uniflow-queueless-ticket-change";

export function setQueueLessActiveTicketPresent(isActive: boolean) {
  if ((window.localStorage.getItem(activeTicketStorageKey) === "1") === isActive) {
    return;
  }
  if (isActive) {
    window.localStorage.setItem(activeTicketStorageKey, "1");
  } else {
    window.localStorage.removeItem(activeTicketStorageKey);
  }
  window.dispatchEvent(new Event(activeTicketChangedEvent));
}

export function subscribeToQueueLessActiveTicket(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(activeTicketChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(activeTicketChangedEvent, onChange);
  };
}

export function hasQueueLessActiveTicketHint() {
  return window.localStorage.getItem(activeTicketStorageKey) === "1";
}

export async function fetchQueueLess<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!supabase) {
    throw new Error("Conexiunea QueueLess nu este configurată în browser.");
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Autentifică-te din nou pentru a folosi QueueLess.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null &&
      "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Nu am putut finaliza solicitarea QueueLess.";
    throw new Error(message);
  }
  return payload as T;
}
