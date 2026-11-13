"use client";

import { getWeekdayName } from "@/lib/schedule-parser";
import type { ScheduleEvent } from "@/lib/schedule-storage";

type ScheduleReviewProps = {
  events: ScheduleEvent[];
  onChange: (
    eventId: string,
    field: keyof Omit<ScheduleEvent, "id">,
    value: string | number,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  isPageReview?: boolean;
};

export default function ScheduleReview({
  events,
  onChange,
  onSave,
  onCancel,
  isPageReview = false,
}: ScheduleReviewProps) {
  return (
    <div className={`schedule-review${isPageReview ? " schedule-page-review" : ""}`}>
      {isPageReview && (
        <div className="schedule-page-review-heading">
          <p className="eyebrow">VERIFICARE IMPORT</p>
          <h2>Am detectat {events.length} cursuri</h2>
          <p className="muted">Verifică informațiile înainte să salvezi orarul.</p>
        </div>
      )}
      <div className="schedule-review-list">
        {events.map((event) => (
          <div className="schedule-review-row" key={event.id}>
            <select
              aria-label={`Ziua pentru ${event.title}`}
              onChange={(change) => onChange(event.id, "weekday", Number(change.target.value))}
              value={event.weekday}
            >
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => (
                <option key={weekday} value={weekday}>{getWeekdayName(weekday)}</option>
              ))}
            </select>
            <input
              aria-label={`Ora de început pentru ${event.title}`}
              onChange={(change) => onChange(event.id, "start", change.target.value)}
              type="time"
              value={event.start}
            />
            <span>–</span>
            <input
              aria-label={`Ora de sfârșit pentru ${event.title}`}
              onChange={(change) => onChange(event.id, "end", change.target.value)}
              type="time"
              value={event.end}
            />
            <input
              aria-label="Denumirea cursului"
              className="schedule-review-title"
              onChange={(change) => onChange(event.id, "title", change.target.value)}
              value={event.title}
            />
            <input
              aria-label="Sala cursului"
              className="schedule-review-room"
              onChange={(change) => onChange(event.id, "room", change.target.value)}
              placeholder="Sală (opțional)"
              value={event.room}
            />
          </div>
        ))}
      </div>
      <div className={`schedule-review-actions${isPageReview ? " schedule-review-actions-page" : ""}`}>
        <button className="button button-secondary" onClick={onSave} type="button">Salvează orarul</button>
        <button className="schedule-cancel-button" onClick={onCancel} type="button">Anulează</button>
      </div>
    </div>
  );
}
