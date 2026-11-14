"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";
import ScheduleReview from "@/components/sections/schedule-review";
import StudyPlannerWidget from "@/components/sections/study-planner-widget";
import { useScheduleUpload } from "@/components/use-schedule-upload";
import { scheduleFileAccept } from "@/lib/schedule-file-types";
import {
  getServerScheduleSnapshot,
  getStoredScheduleSnapshot,
  parseScheduleSnapshot,
  subscribeToSchedule,
} from "@/lib/schedule-storage";
import {
  defaultProfile,
  getServerProfileSnapshot,
  getStoredProfileSnapshot,
  subscribeToProfile,
} from "@/lib/profile";
import {
  formatSavedTaskDueAt,
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  setSavedTaskDone,
  subscribeToSavedTasks,
} from "@/lib/tasks";
import {
  formatLocalDate,
  formatLocalTime,
  getDeadlineDate,
  getIsoWeekNumber,
} from "@/lib/device-time";
import { useDeviceNow } from "@/components/use-device-now";

type DashboardTaskRow = {
  id: string;
  title: string;
  course: string;
  date: string;
  color: string;
  done: boolean;
};

const recommendations = [
  { category: "CAMPUS", title: "Săptămâna carierei începe luni", description: "Ateliere, întâlniri cu alumni și oportunități de internship.", tone: "recommendation-lilac" },
  { category: "PENTRU TINE", title: "Ghid de pregătire pentru sesiune", description: "Un plan simplu ca să intri în sesiune fără stres.", tone: "recommendation-peach" },
];

export default function Dashboard() {
  const now = useDeviceNow();
  const scrollAnimationFrame = useRef<number | null>(null);
  const cancelScrollAnimation = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cancelScrollAnimation.current?.();
    },
    [],
  );
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
  const [taskError, setTaskError] = useState("");
  const scrollToStudyPlanner = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = document.getElementById("study-planner");
    if (!target) return;

    event.preventDefault();
    cancelScrollAnimation.current?.();

    const start = window.scrollY;
    const targetPosition = Math.max(
      0,
      window.scrollY + target.getBoundingClientRect().top - 92,
    );
    const distance = targetPosition - start;
    if (Math.abs(distance) < 1) return;
    const startTime = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 400
      : 1800;
    const interruptScroll = () => cancelScrollAnimation.current?.();
    const cleanup = () => {
      window.removeEventListener("wheel", interruptScroll);
      window.removeEventListener("touchstart", interruptScroll);
      cancelScrollAnimation.current = null;
    };
    const cancel = () => {
      if (scrollAnimationFrame.current !== null) {
        cancelAnimationFrame(scrollAnimationFrame.current);
      }
      scrollAnimationFrame.current = null;
      cleanup();
    };
    cancelScrollAnimation.current = cancel;
    window.addEventListener("wheel", interruptScroll, { passive: true });
    window.addEventListener("touchstart", interruptScroll, { passive: true });

    const animateScroll = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, start + distance * easedProgress);

      if (progress < 1) {
        scrollAnimationFrame.current = requestAnimationFrame(animateScroll);
      } else {
        window.scrollTo(0, targetPosition);
        scrollAnimationFrame.current = null;
        cleanup();
      }
    };

    scrollAnimationFrame.current = requestAnimationFrame(animateScroll);
  };
  const savedProfile = useSyncExternalStore(
    subscribeToProfile,
    getStoredProfileSnapshot,
    getServerProfileSnapshot,
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
  const savedSchedule = useSyncExternalStore(
    subscribeToSchedule,
    getStoredScheduleSnapshot,
    getServerScheduleSnapshot,
  );
  const profileData = savedProfile
    ? JSON.parse(savedProfile) as { name?: string }
    : null;
  const name = profileData?.name ?? defaultProfile.name;
  const scheduleEvents = parseScheduleSnapshot(savedSchedule);
  const hasSchedule = scheduleEvents.length > 0;
  const completed = savedTasks.filter((task) => task.done).length;
  const taskRows: DashboardTaskRow[] = savedTasks.map((task) => ({
    id: task.id,
    title: task.title,
    course: task.subject,
    date: formatSavedTaskDueAt(task.dueAt),
    color: "lavender",
    done: task.done,
  }));
  const visibleTasks = taskRows.slice(0, 3);

  const firstName = name.trim().split(/\s+/)[0] || "student";
  const careerWeekStart = now
    ? formatLocalDate(getDeadlineDate(now, { weekday: 1, time: "" }))
    : null;

  const toggleTask = (task: DashboardTaskRow) => {
    setTaskError("");
    try {
      setSavedTaskDone(task.id, !task.done);
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Nu am putut actualiza task-ul.",
      );
    }
  };

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{now ? `${formatLocalDate(now).toLocaleUpperCase("ro-RO")} · ${formatLocalTime(now)}` : "SE SINCRONIZEAZĂ"} <span className="eyebrow-dot" /> SĂPTĂMÂNA {now ? getIsoWeekNumber(now) : "—"}</p>
          <h1>Bună, {firstName}</h1>
          <p className="muted welcome-copy">Aici vezi ce urmează și ce poți lăsa pe mâine.</p>
        </div>
        <Link className="button button-secondary desktop-add" href="/tasks">
          Adaugă un task
        </Link>
      </section>

      <section className="dashboard-grid">
        <article className="next-class-card" id="schedule-upload">
          {(uploadStatus === "processing" || uploadStatus === "preview" || !hasSchedule) && (
            <div className="next-class-top">
              <span className="pill pill-light">
                {uploadStatus === "processing"
                  ? "SE PROCESEAZĂ"
                  : uploadStatus === "preview"
                    ? "VERIFICĂ ORARUL"
                    : "ORAR NEÎNCĂRCAT"}
              </span>
            </div>
          )}
          {uploadStatus === "preview" ? (
            <>
              <div className="next-class-content schedule-upload-intro">
                <div>
                  <p className="next-class-time">AU FOST DETECTATE {pendingSchedule.length} ORE</p>
                  <h2>Verifică orarul extras</h2>
                </div>
              </div>
              <ScheduleReview
                events={pendingSchedule}
                onCancel={cancelSchedulePreview}
                onChange={updatePendingEvent}
                onSave={savePendingSchedule}
              />
            </>
          ) : uploadStatus === "processing" ? (
            <div className="next-class-content">
              <div>
                <p className="next-class-time">RECUNOAȘTERE OCR</p>
                <h2>{uploadMessage}</h2>
                <p className="next-class-meta">Fișierul este procesat pe dispozitivul tău.</p>
              </div>
            </div>
          ) : hasSchedule ? (
            <div className="next-class-content">
              <div>
                <p className="next-class-time">{scheduleEvents.length} cursuri detectate</p>
                <h2>Orarul tău este pregătit</h2>
                <p className="next-class-meta">Poți vedea programul organizat pe zile.</p>
              </div>
            </div>
          ) : (
            <div className="next-class-content">
              <button
                aria-label="Încarcă fișierul cu orarul"
                className="class-art class-art-upload"
                onClick={openFilePicker}
                type="button"
              >
                +
              </button>
              <div>
                <h2>Încarcă un orar</h2>
                <p className="next-class-meta">Încarcă un PDF, Excel, Word, CSV, TXT sau o fotografie cu programul tău.</p>
              </div>
            </div>
          )}
          {uploadError && <p className="schedule-upload-error" role="alert">{uploadError}</p>}
          <div className="next-class-footer">
            <input
              accept={scheduleFileAccept}
              className="visually-hidden"
              disabled={uploadStatus === "processing"}
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            {uploadStatus === "preview" ? (
              <span>Verifică informațiile înainte de salvare</span>
            ) : (
              <span>{hasSchedule ? "Orarul este salvat pe dispozitiv" : "Fișiere locale, cu excepția Word .doc"}</span>
            )}
            {uploadStatus === "preview" ? null : hasSchedule ? (
              <>
                <Link href="/schedule">Vezi orarul</Link>
                <button className="schedule-upload-link" disabled={uploadStatus === "processing"} onClick={openFilePicker} type="button">Înlocuiește</button>
              </>
            ) : (
              <button className="schedule-upload-link" disabled={uploadStatus === "processing"} onClick={openFilePicker} type="button">
                {uploadStatus === "processing" ? "Se procesează..." : "Încarcă fișierul"}
              </button>
            )}
          </div>
          <div className="class-decoration class-decoration-one" />
          <div className="class-decoration class-decoration-two" />
        </article>

        <Link className="focus-card" href="#study-planner" onClick={scrollToStudyPlanner}>
          
          <span className="focus-label">TIMP DE STUDIU</span>
          <strong>Pregătește-te<br />pentru examen.</strong>
          <span className="focus-link">Planifică sesiuni</span>
          
        </Link>
      </section>

      <section className="stats-grid" aria-label="Statistici academice">
        <article className="stat-card">
          <div><p>Task-uri active</p><strong>{taskRows.filter((task) => !task.done).length}</strong><small>Task-uri încă de făcut</small></div>
          <span className="stat-sparkline sparkline-violet" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
        <article className="stat-card">
          <div><p>Task-uri finalizate</p><strong>{completed}<small className="stat-total">/ {taskRows.length}</small></strong><small>Mai ai <b>{taskRows.length - completed}</b> de bifat</small></div>
          <span className="stat-sparkline sparkline-green" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
        <article className="stat-card">
          <div><p>Cursuri în orar</p><strong>{scheduleEvents.length}</strong><small>Salvate pe dispozitivul tău</small></div>
          <span className="stat-sparkline sparkline-orange" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
      </section>

      <StudyPlannerWidget now={now} schedule={scheduleEvents} tasks={savedTasks} />

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">ȚINE RITMUL</p><h2>Task-urile tale <span className="heading-count">{taskRows.length}</span></h2></div>
          <Link className="text-link" href="/tasks">Vezi toate</Link>
        </div>
        {savedTasksError && <p className="gmail-status-error" role="alert">{savedTasksError}</p>}
        {taskError && <p className="gmail-status-error" role="alert">{taskError}</p>}
        <div className="task-list card-surface">
          {visibleTasks.length === 0 && (
            <div className="schedule-empty">
              <p>Nu ai task-uri salvate încă.</p>
            </div>
          )}
          {visibleTasks.map((task, index) => {
            const isDone = task.done;
            return (
              <div className={`task-row${isDone ? " task-done" : ""}`} key={task.id}>
                <button
                  aria-label={isDone ? `Marchează ${task.title} ca nefinalizat` : `Marchează ${task.title} ca finalizat`}
                  aria-pressed={isDone}
                  className={`task-check ${isDone ? "checked" : ""}`}
                  onClick={() => toggleTask(task)}
                  type="button"
                >
                  {isDone && "✓"}
                </button>
                <span className={`task-color ${task.color}`} />
                <div className="task-description"><strong>{task.title}</strong><small>{task.course}</small></div>
                <span className={`task-due${index === 0 && !isDone && task.date !== "Fără termen" ? " due-soon" : ""}`}>{task.date}</span>
                <button aria-label={`Opțiuni pentru ${task.title}`} className="quiet-icon task-more" type="button">...</button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-block recommendations-section">
        <div className="section-heading">
          <div><p className="eyebrow">DESCOPERĂ</p><h2>Recomandări pentru tine</h2></div>
          <Link className="text-link" href="/materials">Vezi noutățile</Link>
        </div>
        <div className="recommendation-grid">
          {recommendations.map((item) => (
            <article className={`recommendation-card ${item.tone}`} key={item.title}>
              <div className="recommendation-copy"><span>{item.category}</span><h3>{item.category === "CAMPUS" && careerWeekStart ? `Săptămâna carierei începe ${careerWeekStart}` : item.title}</h3><p>{item.description}</p><Link href="/materials">Află mai multe</Link></div>
              
            </article>
          ))}
        </div>
      </section>
      <p className="dashboard-footnote">Ai finalizat {completed} task-uri în total.</p>
    </div>
  );
}
