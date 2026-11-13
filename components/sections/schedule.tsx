"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import ScheduleReview from "@/components/sections/schedule-review";
import { useScheduleUpload } from "@/components/use-schedule-upload";
import { scheduleFileAccept } from "@/lib/schedule-file-types";
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
  clearSchedule,
  getServerScheduleSnapshot,
  getStoredScheduleSnapshot,
  parseScheduleSnapshot,
  subscribeToSchedule,
} from "@/lib/schedule-storage";
import {
  formatSavedTaskDueAt,
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  subscribeToSavedTasks,
} from "@/lib/tasks";

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
  const {
    fileInputRef,
    uploadStatus,
    uploadMessage,
    uploadError,
    pendingSchedule,
    openFilePicker,
    handleFileChange,
    updatePendingEvent,
    savePendingSchedule,
    cancelSchedulePreview,
  } = useScheduleUpload();
  const scheduleSnapshot = useSyncExternalStore(
    subscribeToSchedule,
    getStoredScheduleSnapshot,
    getServerScheduleSnapshot,
  );
  const taskSnapshot = useSyncExternalStore(
    subscribeToSavedTasks,
    getSavedTasksSnapshot,
    getServerSavedTasksSnapshot,
  );
  const { savedTasks, savedTasksError } = useMemo(() => {
    try {
      return { savedTasks: parseSavedTasksSnapshot(taskSnapshot), savedTasksError: "" };
    } catch (error) {
      return {
        savedTasks: [],
        savedTasksError:
          error instanceof Error ? error.message : "Nu am putut încărca task-urile salvate.",
      };
    }
  }, [taskSnapshot]);
  const events = parseScheduleSnapshot(scheduleSnapshot);
  const hasSchedule = events.length > 0;
  const weekAnchor = now
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + weekOffset * 7)
    : null;
  const weekDates = weekAnchor ? getWeekDates(weekAnchor) : [];
  const activeWeekday = selectedWeekday ?? now?.getDay() ?? 1;
  const selectedDate = weekDates.find((date) => date.getDay() === activeWeekday) ?? null;
  const dayTasks = selectedDate
    ? savedTasks
        .filter((task) => task.dueAt !== null &&
          isSameDate(new Date(task.dueAt), selectedDate))
        .sort((left, right) =>
          (left.dueAt ?? "").localeCompare(right.dueAt ?? ""),
        )
    : [];
  const unscheduledTasks = savedTasks.filter((task) => task.dueAt === null);
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
        <div className="schedule-heading-actions">
          {!hasSchedule && uploadStatus !== "preview" && (
            <button
              className="button button-secondary"
              disabled={uploadStatus === "processing"}
              onClick={openFilePicker}
              type="button"
            >
              <Icon name="upload" size={17} />
              {uploadStatus === "processing" ? "Se procesează..." : "Încarcă un orar"}
            </button>
          )}
          {hasSchedule && (
            <button
              className="button button-danger"
              onClick={() => {
                if (window.confirm("Sigur vrei să ștergi orarul salvat? Această acțiune nu poate fi anulată.")) {
                  clearSchedule();
                }
              }}
              type="button"
            >
              Șterge orarul
            </button>
          )}
        </div>
      </div>
      <input
        accept={scheduleFileAccept}
        className="visually-hidden"
        disabled={uploadStatus === "processing"}
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      {uploadStatus === "processing" && (
        <div className="card-surface schedule-upload-state" role="status">
          <Icon name="sparkles" size={20} />
          <div>
            <p className="eyebrow">RECUNOAȘTERE OCR</p>
            <h2>{uploadMessage}</h2>
            <p className="muted">Fișierul este procesat pe dispozitivul tău.</p>
          </div>
        </div>
      )}
      {uploadStatus === "preview" && (
        <div className="card-surface schedule-review-card">
          <ScheduleReview
            events={pendingSchedule}
            isPageReview
            onCancel={cancelSchedulePreview}
            onChange={updatePendingEvent}
            onSave={savePendingSchedule}
          />
          {uploadError && <p className="schedule-upload-error" role="alert">{uploadError}</p>}
        </div>
      )}
      {uploadError && uploadStatus !== "preview" && (
        <p className="schedule-page-upload-error" role="alert">{uploadError}</p>
      )}
      <section className="card-surface week-picker" aria-label="Selectează ziua săptămânii">
        <button aria-label="Săptămâna anterioară" className="week-arrow" onClick={() => setWeekOffset((offset) => offset - 1)} type="button"><span>‹</span></button>
        <div className="week-days">{Array.from({ length: 7 }, (_, index) => {
          const date = weekDates[index];
          const selected = !!date && date.getDay() === activeWeekday;
          const hasTasks = date
            ? savedTasks.some((task) => task.dueAt !== null &&
              isSameDate(new Date(task.dueAt), date))
            : false;

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
              {(hasTasks || (isToday && selected)) && <i />}
            </button>
          );
        })}</div>
        <button aria-label="Săptămâna următoare" className="week-arrow" onClick={() => setWeekOffset((offset) => offset + 1)} type="button"><span>›</span></button>
        <span className="week-range">{weekAnchor ? formatWeekRange(weekAnchor) : "Se sincronizează"}</span>
      </section>
      {savedTasksError && <p className="gmail-status-error" role="alert">{savedTasksError}</p>}
      <section className="schedule-board">
        <div className="schedule-date">
          <span className="today-tag">{isToday && now ? `ASTĂZI · ${formatLocalTime(now)}` : getWeekdayName(activeWeekday).toLocaleUpperCase("ro-RO")}</span>
          <h2>{selectedDate ? formatLocalDate(selectedDate) : "Data locală"}</h2>
          <p>{dayEvents.length} cursuri <span>·</span> {dayTasks.length} task-uri <span>·</span> {formatDuration(totalMinutes)} în campus</p>
        </div>
        <div className="schedule-timeline">
          {!events.length ? (
            <div className="schedule-empty">
              <Icon name="calendar" size={20} />
              <p>{uploadStatus === "preview" ? "Salvează orarul pentru a vedea cursurile pe zile." : "Încarcă un orar pentru a vedea cursurile pe zile."}</p>
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
          {dayTasks.length > 0 && (
            <>
              <p className="eyebrow">TASK-URI PENTRU ZIUA ALEASĂ</p>
              {dayTasks.map((task, index) => (
                <article className="schedule-item" key={task.id}>
                  <div className="schedule-time">
                    <strong>{formatLocalTime(new Date(task.dueAt!))}</strong>
                    <span>Termen</span>
                  </div>
                  <div className={`schedule-event ${eventColors[(dayEvents.length + index) % eventColors.length]}`}>
                    <span className="event-type">
                      {task.category}{task.done ? " · Finalizat" : ""}
                    </span>
                    <h3>{task.title}</h3>
                    {task.subject && <p>{task.subject}</p>}
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </section>

      {hasSchedule && <div className="schedule-tip"><span><Icon name="sparkles" size={18} /></span><p><strong>Orar salvat:</strong> îl poți șterge de aici sau înlocui din cardul orarului de pe pagina Acasă.</p></div>}

      {unscheduledTasks.length > 0 && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DE PROGRAMAT</p>
              <h2>Task-uri fără termen <span className="heading-count">{unscheduledTasks.length}</span></h2>
            </div>
            <Link className="text-link" href="/tasks">Gestionează task-urile</Link>
          </div>
          <div className="card-surface tasks-full-list">
            {unscheduledTasks.map((task, index) => (
              <article className={`task-row${task.done ? " task-done" : ""}`} key={task.id}>
                <span className={`task-color ${index % 2 ? "mint" : "lavender"}`} />
                <div className="task-description">
                  <strong>{task.title}</strong>
                  <small>{task.subject}</small>
                </div>
                <span className="task-category">{task.category}</span>
                <span className="task-due"><Icon name="clock" size={14} />{formatSavedTaskDueAt(task.dueAt)}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
