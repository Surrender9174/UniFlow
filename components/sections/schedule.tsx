"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { useDeviceNow } from "@/components/use-device-now";
import {
  formatLocalDate,
  formatLocalTime,
  formatWeekRange,
  formatWeekdayShort,
  getAcademicYearLabel,
  getWeekDates,
} from "@/lib/device-time";
import { getWeekdayName } from "@/lib/schedule-parser";
import {
  getServerScheduleSnapshot,
  getStoredScheduleSnapshot,
  parseScheduleSnapshot,
  subscribeToSchedule,
} from "@/lib/schedule-storage";

const eventColors = ["schedule-lilac", "schedule-blue", "schedule-green", "schedule-peach"];

function getMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours && remainingMinutes
    ? `${hours}h ${remainingMinutes}m`
    : hours ? `${hours}h` : `${remainingMinutes}m`;
}

function isSameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export default function SchedulePage() {
  const now = useDeviceNow();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const scheduleSnapshot = useSyncExternalStore(
    subscribeToSchedule,
    getStoredScheduleSnapshot,
    getServerScheduleSnapshot,
  );
  const events = parseScheduleSnapshot(scheduleSnapshot);
  const weekAnchor = now
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7)
    : null;
  const weekDates = weekAnchor ? getWeekDates(weekAnchor) : [];
  const activeWeekday = selectedWeekday ?? now?.getDay() ?? 1;
  const selectedDate = weekDates.find((date) => date.getDay() === activeWeekday) ?? null;
  const dayEvents = events
    .filter((event) => event.weekday === activeWeekday)
    .sort((left, right) => left.start.localeCompare(right.start));
  const totalMinutes = dayEvents.reduce(
    (total, event) => total + Math.max(0, getMinutes(event.end) - getMinutes(event.start)),
    0,
  );
  const isToday = !!now && !!selectedDate && isSameDate(now, selectedDate);
  const currentMinutes = isToday && now ? now.getHours() * 60 + now.getMinutes() : -1;
  const currentEventIndex = dayEvents.findIndex(
    (event) => currentMinutes >= getMinutes(event.start) && currentMinutes < getMinutes(event.end),
  );
  const nextEventIndex = dayEvents.findIndex((event) => getMinutes(event.start) > currentMinutes);
  const markerIndex = isToday
    ? currentEventIndex >= 0 ? currentEventIndex : nextEventIndex
    : -1;

  return (
    <div className="section-page">
      <div className="page-heading schedule-heading">
        <div><p className="eyebrow">AN UNIVERSITAR · {now ? getAcademicYearLabel(now) : "—"}</p><h1>Orarul meu</h1><p className="muted">Programul tău, organizat pe zile.</p></div>
        <Link className="button button-secondary" href="/dashboard#schedule-upload"><Icon name="upload" size={17} /> Încarcă un orar</Link>
      </div>
      <section className="card-surface week-picker" aria-label="Selectează ziua săptămânii">
        <button aria-label="Săptămâna anterioară" className="week-arrow" onClick={() => setWeekOffset((offset) => offset - 1)} type="button"><span>‹</span></button>
        <div className="week-days">{Array.from({ length: 7 }, (_, index) => {
          const date = weekDates[index];
          const selected = !!date && date.getDay() === activeWeekday;

          return (
            <button
              aria-label={date ? formatLocalDate(date) : "Se sincronizează"}
              aria-pressed={selected}
              className={`week-day${selected ? " selected" : ""}`}
              key={date?.toISOString() ?? index}
              onClick={() => date && setSelectedWeekday(date.getDay())}
              type="button"
            >
              <span>{date ? formatWeekdayShort(date) : "···"}</span>
              <strong>{date?.getDate() ?? "--"}</strong>
              {isToday && selected && <i />}
            </button>
          );
        })}</div>
        <button aria-label="Săptămâna următoare" className="week-arrow" onClick={() => setWeekOffset((offset) => offset + 1)} type="button"><span>›</span></button>
        <span className="week-range">{weekAnchor ? formatWeekRange(weekAnchor) : "Se sincronizează"}</span>
      </section>
      <section className="schedule-board">
        <div className="schedule-date">
          <span className="today-tag">{isToday && now ? `ASTĂZI · ${formatLocalTime(now)}` : getWeekdayName(activeWeekday).toLocaleUpperCase("ro-RO")}</span>
          <h2>{selectedDate ? formatLocalDate(selectedDate) : "Data locală"}</h2>
          <p>{dayEvents.length} cursuri <span>·</span> {formatDuration(totalMinutes)} în campus</p>
        </div>
        <div className="schedule-timeline">
          {!events.length ? (
            <div className="schedule-empty">
              <Icon name="calendar" size={20} />
              <p>Încarcă un orar pentru a vedea cursurile pe zile.</p>
            </div>
          ) : dayEvents.length ? dayEvents.map((event, index) => (
            <article className="schedule-item" key={event.id}>
              <div className="schedule-time"><strong>{event.start}</strong><span>{formatDuration(getMinutes(event.end) - getMinutes(event.start))}</span></div>
              <div className={`schedule-event ${eventColors[index % eventColors.length]}`}>
                <span className="event-type">{event.type}</span>
                <h3>{event.title}</h3>
                {event.room && <p><Icon name="map" size={14} />{event.room}</p>}
              </div>
              {now && markerIndex === index && <span aria-label={`Ora locală ${formatLocalTime(now)}`} className="current-time-line"><i /> ACUM · {formatLocalTime(now)}</span>}
            </article>
          )) : (
            <div className="schedule-empty">
              <Icon name="calendar" size={20} />
              <p>Nu ai cursuri trecute în orar pentru {getWeekdayName(activeWeekday).toLocaleLowerCase("ro-RO")}.</p>
            </div>
          )}
        </div>
      </section>
      {!!events.length && <div className="schedule-tip"><span><Icon name="sparkles" size={18} /></span><p><strong>Orar salvat:</strong> programul a fost extras din fișierul tău și îl poți actualiza din pagina Acasă.</p></div>}
    </div>
  );
}
