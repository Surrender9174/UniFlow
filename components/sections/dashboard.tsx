"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import ScheduleReview from "@/components/sections/schedule-review";
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
  formatRelativeDeadline,
  getDeadlineDate,
  getIsoWeekNumber,
  type RelativeDeadline,
} from "@/lib/device-time";
import { useDeviceNow } from "@/components/use-device-now";

type DashboardTask = {
  title: string;
  course: string;
  deadline: RelativeDeadline;
  color: string;
  done: boolean;
};

type DashboardTaskRow = {
  id: string;
  title: string;
  course: string;
  date: string;
  color: string;
  done: boolean;
  savedId?: string;
  demoIndex?: number;
};

const tasks: DashboardTask[] = [
  { title: "Eseu: Etica în tehnologie", course: "Etică profesională", deadline: { daysFromToday: 0, time: "23:59" }, color: "lavender", done: false },
  { title: "Laborator — structuri de date", course: "Algoritmi și structuri de date", deadline: { daysFromToday: 1, time: "12:00" }, color: "mint", done: false },
  { title: "Quiz: Baze de date", course: "Sisteme de gestiune a bazelor de date", deadline: { weekday: 4, time: "10:00" }, color: "peach", done: true },
];

const recommendations = [
  { category: "CAMPUS", title: "Săptămâna carierei începe luni", description: "Ateliere, întâlniri cu alumni și oportunități de internship.", tone: "recommendation-lilac", icon: "graduation" as const },
  { category: "PENTRU TINE", title: "Ghid de pregătire pentru sesiune", description: "Un plan simplu ca să intri în sesiune fără stres.", tone: "recommendation-peach", icon: "target" as const },
];

export default function Dashboard() {
  const now = useDeviceNow();
  const [taskItems, setTaskItems] = useState(tasks);
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
  const completed =
    taskItems.filter((task) => task.done).length +
    savedTasks.filter((task) => task.done).length;
  const taskRows: DashboardTaskRow[] = [
    ...savedTasks.map((task) => ({
      id: task.id,
      savedId: task.id,
      title: task.title,
      course: task.subject,
      date: formatSavedTaskDueAt(task.dueAt),
      color: "lavender",
      done: task.done,
    })),
    ...taskItems.map((task, index) => ({
      id: `demo-${index}`,
      demoIndex: index,
      title: task.title,
      course: task.course,
      date: now ? formatRelativeDeadline(now, task.deadline) : "Se sincronizează",
      color: task.color,
      done: task.done,
    })),
  ];
  const visibleTasks = taskRows.slice(0, 3);

  const firstName = name.trim().split(/\s+/)[0] || "student";
  const careerWeekStart = now
    ? formatLocalDate(getDeadlineDate(now, { weekday: 1, time: "" }))
    : null;

  const toggleTask = (task: DashboardTaskRow) => {
    setTaskError("");
    if (task.savedId) {
      try {
        setSavedTaskDone(task.savedId, !task.done);
      } catch (error) {
        setTaskError(
          error instanceof Error ? error.message : "Nu am putut actualiza task-ul.",
        );
      }
      return;
    }
    if (task.demoIndex !== undefined) {
      setTaskItems((current) =>
        current.map((item, index) =>
          index === task.demoIndex ? { ...item, done: !item.done } : item,
        ),
      );
    }
  };

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{now ? `${formatLocalDate(now).toLocaleUpperCase("ro-RO")} · ${formatLocalTime(now)}` : "SE SINCRONIZEAZĂ"} <span className="eyebrow-dot" /> SĂPTĂMÂNA {now ? getIsoWeekNumber(now) : "—"}</p>
          <h1>Bună , {firstName} </h1>
          <p className="muted welcome-copy">Un pas mic azi, un semestru mai ușor mâine.</p>
        </div>
        <Link className="button button-secondary desktop-add" href="/tasks">
          <Icon name="plus" size={17} /> Adaugă un task
        </Link>
      </section>

      <section className="dashboard-grid">
        <article className="next-class-card" id="schedule-upload">
          <div className="next-class-top">
            <span className="pill pill-light">{uploadStatus === "processing" ? "SE PROCESEAZĂ" : uploadStatus === "preview" ? "VERIFICĂ ORARUL" : hasSchedule ? <><span className="live-dot" /> ORAR ÎNCĂRCAT</> : "ORAR NEÎNCĂRCAT"}</span>
          </div>
          {uploadStatus === "preview" ? (
            <>
              <div className="next-class-content schedule-upload-intro">
                <div className="class-art"><Icon name="calendar" size={26} /></div>
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
              <div className="class-art"><Icon name="sparkles" size={27} /></div>
              <div>
                <p className="next-class-time">RECUNOAȘTERE OCR</p>
                <h2>{uploadMessage}</h2>
                <p className="next-class-meta">Fișierul este procesat pe dispozitivul tău.</p>
              </div>
            </div>
          ) : hasSchedule ? (
            <div className="next-class-content">
              <div className="class-art"><Icon name="book" size={28} /></div>
              <div>
                <p className="next-class-time"><Icon name="calendar" size={15} /> {scheduleEvents.length} cursuri detectate</p>
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
                <Icon name="upload" size={28} />
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
              <span><Icon name="check" size={16} /> Verifică informațiile înainte de salvare</span>
            ) : (
              <span><Icon name={hasSchedule ? "calendar" : "lock"} size={16} />{hasSchedule ? "Orarul este salvat pe dispozitiv" : "Fișiere locale, cu excepția Word .doc"}</span>
            )}
            {uploadStatus === "preview" ? null : hasSchedule ? (
              <>
                <Link href="/schedule">Vezi orarul <Icon name="arrow" size={15} /></Link>
                <button className="schedule-upload-link" disabled={uploadStatus === "processing"} onClick={openFilePicker} type="button">Înlocuiește</button>
              </>
            ) : (
              <button className="schedule-upload-link" disabled={uploadStatus === "processing"} onClick={openFilePicker} type="button">
                {uploadStatus === "processing" ? "Se procesează..." : "Încarcă fișierul"} <Icon name="arrow" size={15} />
              </button>
            )}
          </div>
          <div className="class-decoration class-decoration-one" />
          <div className="class-decoration class-decoration-two" />
        </article>

        <Link className="focus-card" href="/assistant">
          
          <span className="focus-label">STUDY BUDDY</span>
          <strong>Ai nevoie de<br />un plan de studiu?</strong>
          <span className="focus-link">Întreabă Uni <Icon name="arrow" size={15} /></span>
          
        </Link>
      </section>

      <section className="stats-grid" aria-label="Statistici academice">
        <article className="stat-card">
          <span className="stat-icon stat-violet"><Icon name="check" size={18} /></span>
          <div><p>Task-uri active</p><strong>{taskRows.filter((task) => !task.done).length}</strong><small><span className="trend-up">↑ 2</span> față de săptămâna trecută</small></div>
          <span className="stat-sparkline sparkline-violet" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-green"><Icon name="file" size={18} /></span>
          <div><p>Proiecte practice finalizate</p><strong>{completed + 4}<small className="stat-total">/ 8</small></strong><small>Mai ai <b>4</b> de bifat</small></div>
          <span className="stat-sparkline sparkline-green" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-orange"><Icon name="target" size={18} /></span>
          <div><p>Teste promovate</p><strong>6<small className="stat-total">/ 8</small></strong><small>Ritm bun, continuă!</small></div>
          <span className="stat-sparkline sparkline-orange" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">ȚINE RITMUL</p><h2>Task-urile tale <span className="heading-count">{taskRows.length}</span></h2></div>
          <Link className="text-link" href="/tasks">Vezi toate <Icon name="arrow" size={15} /></Link>
        </div>
        {savedTasksError && <p className="gmail-status-error" role="alert">{savedTasksError}</p>}
        {taskError && <p className="gmail-status-error" role="alert">{taskError}</p>}
        <div className="task-list card-surface">
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
                  {isDone && <Icon name="check" size={13} />}
                </button>
                <span className={`task-color ${task.color}`} />
                <div className="task-description"><strong>{task.title}</strong><small>{task.course}</small></div>
                <span className={`task-due${index === 0 && !isDone && task.date !== "Fără termen" ? " due-soon" : ""}`}><Icon name="clock" size={14} />{task.date}</span>
                <button aria-label={`Opțiuni pentru ${task.title}`} className="quiet-icon task-more" type="button"><Icon name="more" size={18} /></button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-block recommendations-section">
        <div className="section-heading">
          <div><p className="eyebrow">DESCOPERĂ</p><h2>Recomandări pentru tine</h2></div>
          <Link className="text-link" href="/materials">Vezi noutățile <Icon name="arrow" size={15} /></Link>
        </div>
        <div className="recommendation-grid">
          {recommendations.map((item) => (
            <article className={`recommendation-card ${item.tone}`} key={item.title}>
              <div className="recommendation-illustration"><Icon name={item.icon} size={25} /></div>
              <div className="recommendation-copy"><span>{item.category}</span><h3>{item.category === "CAMPUS" && careerWeekStart ? `Săptămâna carierei începe ${careerWeekStart}` : item.title}</h3><p>{item.description}</p><Link href="/materials">Află mai multe <Icon name="arrow" size={14} /></Link></div>
              
            </article>
          ))}
        </div>
      </section>
      <p className="dashboard-footnote">Ai deja bifat {completed + 5} lucruri săptămâna asta. Bravo! <span>✦</span></p>
    </div>
  );
}
