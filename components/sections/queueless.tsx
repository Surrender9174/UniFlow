"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import {
  fetchQueueLess,
  setQueueLessActiveTicketPresent,
} from "@/lib/queueless/client";
import type {
  QueueLessCategory,
  QueueLessLocation,
  QueueLessTicket,
} from "@/lib/queueless/types";
import { supabase } from "@/lib/supabase";
import { useDeviceNow } from "@/components/use-device-now";

type QueueLessSnapshot = {
  locations: QueueLessLocation[];
  activeTicket: QueueLessTicket | null;
};

const categories: Array<{ id: QueueLessCategory | "all"; label: string }> = [
  { id: "all", label: "Toate" },
  { id: "campus_office", label: "Birouri campus" },
  { id: "food_coffee", label: "Mâncare & cafea" },
  { id: "library", label: "Bibliotecă" },
  { id: "city_service", label: "Servicii în oraș" },
];

const categoryLabels: Record<QueueLessCategory, string> = {
  campus_office: "BIROU CAMPUS",
  food_coffee: "MÂNCARE & CAFEA",
  library: "BIBLIOTECĂ",
  city_service: "SERVICIU PARTENER",
};

function getCrowdLevel(waitMinutes: number) {
  if (waitMinutes < 10) return { label: "Liber", tone: "low" };
  if (waitMinutes < 25) return { label: "Moderat", tone: "moderate" };
  return { label: "Aglomerat", tone: "peak" };
}

function formatCountdown(milliseconds: number) {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 1) return "sub 1 min";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

export default function QueueLessSection() {
  const [locations, setLocations] = useState<QueueLessLocation[]>([]);
  const [ticket, setTicket] = useState<QueueLessTicket | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [category, setCategory] = useState<QueueLessCategory | "all">("all");
  const [confirmedDocuments, setConfirmedDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );
  const deviceNow = useDeviceNow();
  const now = deviceNow?.getTime() ?? null;

  const refresh = useCallback(async () => {
    try {
      const snapshot = await fetchQueueLess<QueueLessSnapshot>("/api/queueless");
      setLocations(snapshot.locations);
      setTicket(snapshot.activeTicket);
      setQueueLessActiveTicketPresent(!!snapshot.activeTicket);
      setSelectedLocationId((current) =>
        snapshot.locations.some((location) => location.id === current)
          ? current
          : snapshot.locations[0]?.id ?? "",
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut încărca QueueLess.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);

    const client = supabase;
    if (!client) {
      queueMicrotask(() => setRealtimeStatus("offline"));
      return () => window.clearInterval(refreshTimer);
    }
    let active = true;
    let channel: ReturnType<typeof client.channel> | null = null;
    void client.auth.getUser()
      .then(({ data, error: authError }) => {
        if (!active) return;
        if (authError || !data.user) {
          setRealtimeStatus("offline");
          return;
        }
        channel = client
          .channel(`queueless-live-${data.user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "queueless_queue_stats" },
            () => void refresh(),
          )
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
          .subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") setRealtimeStatus("live");
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" ||
              status === "CLOSED") setRealtimeStatus("offline");
          });
      })
      .catch(() => {
        if (active) setRealtimeStatus("offline");
      });

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      if (channel) void client.removeChannel(channel);
    };
  }, [refresh]);

  const filteredLocations = useMemo(
    () => locations.filter((location) =>
      category === "all" || location.category === category
    ),
    [category, locations],
  );
  const selectedLocation = locations.find(
    (location) => location.id === selectedLocationId,
  ) ?? null;
  const ticketLocation = locations.find(
    (location) => location.id === ticket?.location_id,
  ) ?? null;
  const communityWaiting = locations.reduce(
    (total, location) => total + location.waiting_count,
    0,
  );
  const communityWaitMinutes = locations.reduce(
    (total, location) => total + location.estimated_wait_minutes,
    0,
  );
  const ticketEta = ticket && ticketLocation && now !== null
    ? new Date(ticket.updated_at).getTime() +
      ticket.queue_position * ticketLocation.average_service_minutes * 60_000 - now
    : null;
  const documentsComplete = !!selectedLocation &&
    selectedLocation.required_documents.every((document) =>
      confirmedDocuments.includes(document)
    );

  const selectLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setConfirmedDocuments([]);
    setNotice("");
  };

  const joinQueue = async () => {
    if (!selectedLocation) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchQueueLess<{ ticket: QueueLessTicket }>(
        "/api/queueless",
        {
          method: "POST",
          body: JSON.stringify({
            locationId: selectedLocation.id,
            confirmedDocuments,
          }),
        },
      );
      setTicket(response.ticket);
      setNotice(`Ai primit bonul ${response.ticket.ticket_code}.`);
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut intra în coadă.",
      );
    } finally {
      setBusy(false);
    }
  };

  const delayTicket = async () => {
    if (!ticket) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchQueueLess<{ ticket: QueueLessTicket }>(
        `/api/queueless/tickets/${ticket.id}/delay`,
        { method: "POST" },
      );
      setTicket(response.ticket);
      setNotice("Ți-ai amânat bonul cu o poziție.");
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut amâna bonul.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section-page queueless-page">
      <header className="page-heading queueless-heading">
        <div>
          <p className="eyebrow">CAMPUS FĂRĂ COZI</p>
          <h1>QueueLess</h1>
          <p className="muted">
            Vezi aglomerația și ia un bon virtual înainte să ajungi la ghișeu.
          </p>
        </div>
        <Link className="button button-secondary" href="/queueless/staff">
          <Icon name="settings" size={16} /> Mod personal
        </Link>
      </header>

      <section className="queueless-community card-surface" aria-label="Situația live a cozilor">
        <div>
          <span className={`queueless-live-dot${realtimeStatus === "live" ? "" : " reconnecting"}`} />
          <span>
            {realtimeStatus === "live"
              ? "COZI LIVE ÎN CAMPUS"
              : realtimeStatus === "connecting"
                ? "SE CONECTEAZĂ LA COZI"
                : "ACTUALIZARE PERIODICĂ"}
          </span>
        </div>
        <strong>{communityWaiting}</strong>
        <small>persoane așteaptă</small>
        <i />
        <strong>{communityWaitMinutes} min</strong>
        <small>timp estimat cumulat</small>
      </section>

      <section className="queueless-directory-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ALEGE UN SERVICIU</p>
            <h2>Unde vrei să mergi?</h2>
          </div>
          <button
            className="queueless-refresh"
            disabled={loading}
            onClick={() => void refresh()}
            type="button"
          >
            Reîmprospătează
          </button>
        </div>
        <div aria-label="Filtrează locațiile" className="queueless-categories" role="group">
          {categories.map((item) => (
            <button
              aria-pressed={category === item.id}
              className={category === item.id ? "selected" : ""}
              key={item.id}
              onClick={() => setCategory(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p className="queueless-error" role="alert">{error}</p>}
        {loading && !locations.length ? (
          <div className="queueless-empty card-surface">Se încarcă locațiile...</div>
        ) : !locations.length ? (
          <div className="queueless-empty card-surface">
            <Icon name="map" size={23} />
            <strong>QueueLess nu este încă inițializat</strong>
            <p>
              Aplică migrarea QueueLess din Supabase, apoi reîncarcă pagina.
            </p>
          </div>
        ) : (
          <div className="queueless-location-grid">
            {filteredLocations.map((location) => {
              const crowd = getCrowdLevel(location.estimated_wait_minutes);
              return (
                <button
                  aria-pressed={selectedLocationId === location.id}
                  className={`queueless-location-card${selectedLocationId === location.id ? " selected" : ""}`}
                  key={location.id}
                  onClick={() => selectLocation(location.id)}
                  type="button"
                >
                  <span className="queueless-location-top">
                    <span>{categoryLabels[location.category]}</span>
                    <span className={`queueless-crowd ${crowd.tone}`}>
                      <i /> {crowd.label}
                    </span>
                  </span>
                  <strong>{location.name}</strong>
                  <small>{location.description}</small>
                  <span className="queueless-location-metrics">
                    <span><b>{location.waiting_count}</b> în coadă</span>
                    <span><b>{location.estimated_wait_minutes}</b> min așteptare</span>
                  </span>
                  <span className="queueless-location-address">
                    <Icon name="map" size={13} /> {location.address}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedLocation && !ticket && (
        <section className="queueless-join-card card-surface">
          <div className="queueless-join-heading">
            <div>
              <p className="eyebrow">BON VIRTUAL</p>
              <h2>{selectedLocation.name}</h2>
              <p>{selectedLocation.description}</p>
            </div>
            <span className="queueless-prefix">{selectedLocation.code.toUpperCase()}</span>
          </div>
          {selectedLocation.required_documents.length > 0 && (
            <fieldset className="queueless-checklist">
              <legend>Verifică înainte de vizită</legend>
              <p>Confirmă că ai documentele necesare ca să eviți un drum în plus.</p>
              {selectedLocation.required_documents.map((document) => (
                <label key={document}>
                  <input
                    checked={confirmedDocuments.includes(document)}
                    onChange={(event) => {
                      setConfirmedDocuments((current) =>
                        event.target.checked
                          ? [...current, document]
                          : current.filter((item) => item !== document)
                      );
                    }}
                    type="checkbox"
                  />
                  <span>{document}</span>
                </label>
              ))}
            </fieldset>
          )}
          {error && <p className="queueless-error" role="alert">{error}</p>}
          {notice && <p className="queueless-success" role="status">{notice}</p>}
          <div className="queueless-join-footer">
            <span>
              Estimare live: <strong>{selectedLocation.estimated_wait_minutes} min</strong>
            </span>
            <button
              className="button button-primary"
              disabled={busy || !documentsComplete}
              onClick={() => void joinQueue()}
              type="button"
            >
              {busy ? "Se emite bonul..." : "Ia un bon virtual"}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        </section>
      )}

      {ticket && ticketLocation && (
        <section className="queueless-ticket card-surface" aria-live="polite">
          <div className="queueless-ticket-header">
            <div>
              <p className="eyebrow">BONUL TĂU ACTIV</p>
              <h2>{ticketLocation.name}</h2>
            </div>
            <span className={`queueless-ticket-state ${ticket.status.toLowerCase()}`}>
              {ticket.status === "WAITING" ? "În așteptare" :
                ticket.status === "DELAYED" ? "Amânat o poziție" :
                  ticket.status === "NOTIFIED" ? "Ești următorul" : "La ghișeu"}
            </span>
          </div>
          <div className="queueless-ticket-main">
            <span className="queueless-ticket-code">{ticket.ticket_code}</span>
            <div>
              <strong>
                {ticket.status === "NOTIFIED" || ticket.status === "SERVING"
                  ? "Mergi la ghișeu"
                  : ticketEta !== null
                    ? formatCountdown(ticketEta)
                    : "Se calculează"}
              </strong>
              <small>
                Poziția {ticket.queue_position} · {ticketLocation.address}
              </small>
              {ticket.counter_name && (
                <small className="queueless-counter">{ticket.counter_name}</small>
              )}
            </div>
            {ticket.status === "WAITING" && ticketEta !== null &&
              ticketEta <= 15 * 60_000 && ticketEta > 0 && (
                <p className="queueless-alert" role="status">
                  Mai sunt cel mult 15 minute. Începe să te îndrepți spre locație.
                </p>
              )}
            {(ticket.status === "WAITING" || ticket.status === "DELAYED") &&
              ticketEta !== null && ticketEta <= 0 && (
                <p className="queueless-alert" role="status">
                  Rândul tău se apropie. Mergi la ghișeu.
                </p>
              )}
          </div>
          {error && <p className="queueless-error" role="alert">{error}</p>}
          {notice && <p className="queueless-success" role="status">{notice}</p>}
          {ticket.status === "WAITING" && !ticket.delay_used && (
            <button
              className="button button-secondary queueless-delay"
              disabled={busy}
              onClick={() => void delayTicket()}
              type="button"
            >
              Amână-mă cu o poziție
            </button>
          )}
        </section>
      )}

      <p className="queueless-disclaimer">
        Timpul este estimativ și poate varia în funcție de serviciu. Dacă ești chemat,
        mergi la ghișeu; bonul nu înlocuiește prezența la locație.
      </p>
    </div>
  );
}
