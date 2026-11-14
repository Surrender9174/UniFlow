"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchQueueLess,
  hasQueueLessActiveTicketHint,
  setQueueLessActiveTicketPresent,
  subscribeToQueueLessActiveTicket,
} from "@/lib/queueless/client";
import type { QueueLessLocation, QueueLessTicket } from "@/lib/queueless/types";
import { supabase } from "@/lib/supabase";
import { useDeviceNow } from "@/components/use-device-now";

type QueueLessSnapshot = {
  locations: QueueLessLocation[];
  activeTicket: QueueLessTicket | null;
};

export default function QueueLessActiveTicket() {
  const pathname = usePathname();
  const [ticket, setTicket] = useState<QueueLessTicket | null>(null);
  const [location, setLocation] = useState<QueueLessLocation | null>(null);
  const [error, setError] = useState("");
  const deviceNow = useDeviceNow();
  const now = deviceNow?.getTime() ?? null;

  const refresh = useCallback(async () => {
    if (!hasQueueLessActiveTicketHint()) {
      setTicket(null);
      setLocation(null);
      setError("");
      return;
    }

    try {
      const snapshot = await fetchQueueLess<QueueLessSnapshot>("/api/queueless");
      setTicket(snapshot.activeTicket);
      setLocation(
        snapshot.locations.find((item) =>
          item.id === snapshot.activeTicket?.location_id
        ) ?? null,
      );
      setQueueLessActiveTicketPresent(!!snapshot.activeTicket);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut actualiza bonul QueueLess.",
      );
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const timerId = window.setInterval(() => {
      if (hasQueueLessActiveTicketHint()) void refresh();
    }, 30_000);

    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let setupPromise: Promise<void> | null = null;
    const setupRealtime = () => {
      if (!supabase || channel || setupPromise || !hasQueueLessActiveTicketHint()) return;
      const client = supabase;
      setupPromise = client.auth.getUser()
        .then(({ data, error: authError }) => {
          if (!active) return;
          if (authError) {
            setError(authError.message);
            return;
          }
          if (!data.user) return;
          channel = client
            .channel(`queueless-ticket-pill-${data.user.id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "queueless_tickets",
                filter: `user_id=eq.${data.user.id}`,
              },
              () => void refresh(),
            )
            .subscribe();
        })
        .catch((requestError: unknown) => {
          if (!active) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Nu am putut sincroniza bonul QueueLess.",
          );
        })
        .finally(() => {
          setupPromise = null;
        });
    };
    const syncTicket = () => {
      void refresh();
      setupRealtime();
    };
    const unsubscribe = subscribeToQueueLessActiveTicket(syncTicket);
    setupRealtime();

    return () => {
      active = false;
      window.clearInterval(timerId);
      unsubscribe();
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  if (pathname === "/queueless" || pathname === "/queueless/staff") return null;
  if (!ticket && !error) return null;

  if (error) {
    return (
      <Link className="queueless-global-pill queueless-global-error" href="/queueless">
        <span>Verifică bonul QueueLess</span>
      </Link>
    );
  }
  if (!ticket) return null;

  const remaining = now === null
    ? null
    : ticket.status === "WAITING" || ticket.status === "DELAYED"
      ? Math.max(
      0,
      Math.ceil((
        new Date(ticket.updated_at).getTime() +
        ticket.queue_position * (location?.average_service_minutes ?? 5) * 60_000 -
        now
      ) / 60_000),
    )
      : 0;
  const called = ticket.status === "NOTIFIED" || ticket.status === "SERVING";

  return (
    <Link className="queueless-global-pill" href="/queueless">
      <span>
        <strong>{ticket.ticket_code}</strong>
        <small>
          {called
            ? ticket.counter_name ?? "Ești chemat"
            : remaining === null
              ? "Se calculează timpul"
              : `${location?.name ?? "QueueLess"} · ~${remaining} min`}
        </small>
      </span>
    </Link>
  );
}
