"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  subscribeToSavedTasks,
  type SavedTask,
} from "@/lib/tasks";

type DatedTask = Omit<SavedTask, "dueAt"> & { dueAt: string };

function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function subscribeToCurrentDate(onChange: () => void) {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function getCurrentDateSnapshot() {
  return getLocalDateKey(new Date());
}

function getServerDateSnapshot() {
  return "";
}

function getStartOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function getWeekDates(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export default function SchedulePage() {
  const currentDateKey = useSyncExternalStore(
    subscribeToCurrentDate,
    getCurrentDateSnapshot,
    getServerDateSnapshot,
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
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
  const today = currentDateKey ? getDateFromKey(currentDateKey) : null;
  const weekStart = today ? getStartOfWeek(today) : null;
  if (weekStart) weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekDays = weekStart
    ? getWeekDates(weekStart).map((date) => ({
        date,
        key: getLocalDateKey(date),
        label: new Intl.DateTimeFormat("ro-RO", { weekday: "short" })
          .format(date)
          .replace(".", "")
          .toLocaleUpperCase("ro-RO"),
      }))
    : [];
  const selectedIndex =
    selectedDayIndex ?? (today ? (today.getDay() + 6) % 7 : 0);
  const selectedDay = weekDays[selectedIndex];
  const selectedDayKey = selectedDay?.key ?? null;
  const activeTasks = savedTasks.filter((task) => !task.done);
  const taskCountsByDay = new Map<string, number>();
  for (const task of activeTasks) {
    if (!task.dueAt) continue;
    const key = getLocalDateKey(new Date(task.dueAt));
    taskCountsByDay.set(key, (taskCountsByDay.get(key) ?? 0) + 1);
  }
  const selectedTasks = activeTasks
    .filter(
      (task): task is DatedTask =>
        task.dueAt !== null &&
        getLocalDateKey(new Date(task.dueAt)) === selectedDayKey,
    )
    .sort((first, second) => Date.parse(first.dueAt) - Date.parse(second.dueAt));
  const unscheduledTasks = activeTasks.filter((task) => task.dueAt === null);
  const todayKey = currentDateKey || null;
  const weekRange = weekDays.length
    ? `${new Intl.DateTimeFormat("ro-RO", {
        day: "numeric",
        month: "short",
      }).format(weekDays[0].date)} — ${new Intl.DateTimeFormat("ro-RO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(weekDays[weekDays.length - 1].date)}`
    : "Se încarcă...";

  const changeWeek = (offset: number) => {
    if (!weekStart) return;
    setWeekOffset((current) => current + offset);
  };

  return (
    <div className="section-page">
      <div className="page-heading schedule-heading">
        <div>
          <p className="eyebrow">PLANIFICARE SĂPTĂMÂNALĂ</p>
          <h1>Orarul meu</h1>
          <p className="muted">Alege o zi ca să vezi task-urile și activitățile programate.</p>
        </div>
        <Link className="button button-secondary" href="/materials"><Icon name="upload" size={17} /> Importă orarul</Link>
      </div>
      <section className="card-surface week-picker" aria-label="Selectează ziua săptămânii">
        <button
          aria-label="Săptămâna anterioară"
          className="week-arrow"
          disabled={!weekStart}
          onClick={() => changeWeek(-1)}
          type="button"
        >
          <span>‹</span>
        </button>
        <div className="week-days">
          {weekDays.map((day, index) => {
            const isSelected = day.key === selectedDayKey;
            const taskCount = taskCountsByDay.get(day.key) ?? 0;
            const dateLabel = new Intl.DateTimeFormat("ro-RO", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(day.date);
            return (
              <button
                aria-label={`${dateLabel}${taskCount ? `, ${taskCount} activități` : ""}`}
                aria-pressed={isSelected}
                className={`week-day${isSelected ? " selected" : ""}`}
                key={day.key}
                onClick={() => setSelectedDayIndex(index)}
                type="button"
              >
                <span>{day.label}</span>
                <strong>{day.date.getDate()}</strong>
                {(day.key === todayKey || taskCount > 0) && <i />}
              </button>
            );
          })}
        </div>
        <button
          aria-label="Săptămâna următoare"
          className="week-arrow"
          disabled={!weekStart}
          onClick={() => changeWeek(1)}
          type="button"
        >
          <span>›</span>
        </button>
        <span className="week-range">{weekRange}</span>
      </section>
      {savedTasksError && <p className="gmail-status-error" role="alert">{savedTasksError}</p>}
      {selectedDay && (
        <section aria-label={`Activități pentru ${selectedDay.label}`} className="schedule-board">
          <div className="schedule-date">
            <span className="today-tag">{selectedDay.label}</span>
            <h2>
              {new Intl.DateTimeFormat("ro-RO", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(selectedDay.date)}
            </h2>
            <p>{selectedTasks.length} activități programate</p>
          </div>
          <div className="schedule-timeline">
            {selectedTasks.length > 0 ? (
              selectedTasks.map((task) => (
                <article className="schedule-item" key={task.id}>
                  <div className="schedule-time">
                    <strong>
                      {new Intl.DateTimeFormat("ro-RO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(task.dueAt))}
                    </strong>
                    <span>Termen</span>
                  </div>
                  <div
                    className={`schedule-event ${
                      task.category === "Test"
                        ? "schedule-peach"
                        : task.category === "Practică"
                          ? "schedule-green"
                          : "schedule-lilac"
                    }`}
                  >
                    <span className="event-type">{task.category}</span>
                    <h3>{task.title}</h3>
                    <p><Icon name="clock" size={14} />{task.subject}</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">Nu ai activități programate pentru această zi.</p>
            )}
            <Link className="text-link" href="/tasks">Vezi toate task-urile</Link>
          </div>
        </section>
      )}
      {unscheduledTasks.length > 0 && (
        <section aria-label="Task-uri fără dată și oră" className="schedule-board">
          <div className="schedule-date">
            <span className="today-tag">DE PROGRAMAT</span>
            <h2>Fără dată și oră</h2>
            <p>{unscheduledTasks.length} activități</p>
          </div>
          <div className="schedule-timeline">
            {unscheduledTasks.map((task) => (
              <article className="schedule-item" key={task.id}>
                <div className="schedule-time"><strong>—</strong><span>Fără termen</span></div>
                <div className="schedule-event schedule-lilac">
                  <span className="event-type">{task.category}</span>
                  <h3>{task.title}</h3>
                  <p><Icon name="clock" size={14} />{task.subject}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
