"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { fetchQueueLess } from "@/lib/queueless/client";
import type { QueueLessStaffLocation } from "@/lib/queueless/types";
import { supabase } from "@/lib/supabase";

type StaffSnapshot = { locations: QueueLessStaffLocation[] };

export default function QueueLessStaffSection() {
  const [locations, setLocations] = useState<QueueLessStaffLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLocationId, setActiveLocationId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchQueueLess<StaffSnapshot>("/api/queueless/staff");
      setLocations(snapshot.locations);
      setActiveLocationId((current) =>
        snapshot.locations.some((location) => location.id === current)
          ? current
          : snapshot.locations[0]?.id ?? "",
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut încărca kiosk-ul QueueLess.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    const client = supabase;
    if (!client) return () => window.clearInterval(refreshTimer);

    const channel = client
      .channel("queueless-staff-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queueless_tickets" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queueless_queue_stats" },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      window.clearInterval(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [refresh]);

  const advanceQueue = async (locationId: string) => {
    setActiveLocationId(locationId);
    setError("");
    setNotice("");
    try {
      const result = await fetchQueueLess<{
        ticket: { ticket_code: string } | null;
        currentStatus: string | null;
      }>(`/api/queueless/staff/${locationId}/next`, { method: "POST" });
      setNotice(
        result.ticket
          ? `Bonul ${result.ticket.ticket_code} a fost chemat.`
          : result.currentStatus === "SERVING"
            ? "Bonul curent este în curs de servire."
            : result.currentStatus === "COMPLETED"
              ? "Servirea a fost finalizată; coada este goală."
              : "Coada este goală.",
      );
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut avansa coada.",
      );
    }
  };

  const selectedLocation = locations.find(
    (location) => location.id === activeLocationId,
  ) ?? null;

  return (
    <div className="section-page queueless-page queueless-staff-page">
      <header className="page-heading queueless-heading">
        <div>
          <p className="eyebrow">KIOSK PENTRU PERSONAL</p>
          <h1>QueueLess Staff</h1>
          <p className="muted">Gestionează bonurile și cheamă următoarea persoană.</p>
        </div>
        <Link className="button button-secondary" href="/queueless">
          <Icon name="arrow" size={16} /> Înapoi la QueueLess
        </Link>
      </header>

      {error && <p className="queueless-error" role="alert">{error}</p>}
      {notice && <p className="queueless-success" role="status">{notice}</p>}

      {loading ? (
        <div className="queueless-empty card-surface">Se verifică accesul...</div>
      ) : !locations.length ? (
        <div className="queueless-empty card-surface">
          <Icon name="lock" size={23} />
          <strong>Nu ai o locație atribuită</strong>
          <p>
            Un administrator trebuie să adauge contul tău în tabelul
            <code> queueless_staff</code> din Supabase.
          </p>
        </div>
      ) : (
        <>
          <div className="queueless-staff-locations" role="group" aria-label="Locația administrată">
            {locations.map((location) => (
              <button
                aria-pressed={location.id === activeLocationId}
                className={location.id === activeLocationId ? "selected" : ""}
                key={location.id}
                onClick={() => setActiveLocationId(location.id)}
                type="button"
              >
                {location.name}
                <span>{location.waiting_count} în așteptare</span>
              </button>
            ))}
          </div>
          {selectedLocation && (
            <section className="queueless-kiosk card-surface">
              <div className="queueless-kiosk-heading">
                <div>
                  <p className="eyebrow">COADĂ LIVE</p>
                  <h2>{selectedLocation.name}</h2>
                </div>
                <span className="queueless-kiosk-wait">
                  ~{selectedLocation.estimated_wait_minutes} min
                </span>
              </div>
              <div className="queueless-kiosk-current">
                {selectedLocation.tickets.find((ticket) => ticket.status === "SERVING") ? (
                  <>
                    <span>LA GHIȘEU</span>
                    <strong>
                      {selectedLocation.tickets.find((ticket) => ticket.status === "SERVING")?.ticket_code}
                    </strong>
                  </>
                ) : (
                  <span>Nicio persoană la ghișeu</span>
                )}
              </div>
              <div className="queueless-kiosk-list">
                <div className="queueless-kiosk-list-heading">
                  <strong>Următoarele bonuri</strong>
                  <span>{selectedLocation.tickets.length} active</span>
                </div>
                {selectedLocation.tickets.length ? (
                  selectedLocation.tickets.map((ticket) => (
                    <div className="queueless-kiosk-ticket" key={ticket.id}>
                      <strong>{ticket.ticket_code}</strong>
                      <span>Poziția {ticket.queue_position}</span>
                      <span>{ticket.status === "DELAYED" ? "Amânat" : ticket.status}</span>
                      {ticket.counter_name && <span>{ticket.counter_name}</span>}
                    </div>
                  ))
                ) : (
                  <p className="queueless-kiosk-empty">Nu există bonuri active în această coadă.</p>
                )}
              </div>
              <button
                className="button button-primary queueless-kiosk-action"
                disabled={!selectedLocation.tickets.length}
                onClick={() => void advanceQueue(selectedLocation.id)}
                type="button"
              >
                <Icon name="arrow" size={16} /> Finalizează / cheamă următorul
              </button>
              <p className="queueless-disclaimer">
                Butonul finalizează bonul servit sau începe servirea celui chemat anterior,
                apoi anunță următorul bon.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
