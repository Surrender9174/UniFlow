"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
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

const tasks = [
  { title: "Eseu: Etica în tehnologie", course: "Etică profesională", date: "Astăzi, 23:59", color: "lavender", done: false },
  { title: "Laborator — structuri de date", course: "Algoritmi și structuri de date", date: "Mâine, 12:00", color: "mint", done: false },
  { title: "Quiz: Baze de date", course: "Sisteme de gestiune a bazelor de date", date: "Joi, 10:00", color: "peach", done: true },
];

const recommendations = [
  { category: "CAMPUS", title: "Săptămâna carierei începe luni", description: "Ateliere, întâlniri cu alumni și oportunități de internship.", tone: "recommendation-lilac", icon: "graduation" as const },
  { category: "PENTRU TINE", title: "Ghid de pregătire pentru sesiune", description: "Un plan simplu ca să intri în sesiune fără stres.", tone: "recommendation-peach", icon: "target" as const },
];

export default function Dashboard() {
  const [taskItems, setTaskItems] = useState(tasks);
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
  const name = savedProfile
    ? (JSON.parse(savedProfile) as { name?: string }).name ?? defaultProfile.name
    : defaultProfile.name;
  const completed =
    taskItems.filter((task) => task.done).length +
    savedTasks.filter((task) => task.done).length;
  const taskRows = [
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
      ...task,
    })),
  ];
  const visibleTasks = taskRows.slice(0, 3);

  const firstName = name.trim().split(/\s+/)[0] || "student";

  const toggleTask = (task: (typeof taskRows)[number]) => {
    setTaskError("");
    if ("savedId" in task) {
      try {
        setSavedTaskDone(task.savedId, !task.done);
      } catch (error) {
        setTaskError(
          error instanceof Error ? error.message : "Nu am putut actualiza task-ul.",
        );
      }
      return;
    }
    if ("demoIndex" in task) {
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
          <p className="eyebrow">LUNI, 23 MARTIE 2026 <span className="eyebrow-dot" /> SĂPTĂMÂNA 8</p>
          <h1>Bună, {firstName} <span className="wave">✦</span></h1>
          <p className="muted welcome-copy">Un pas mic azi, un semestru mai ușor mâine.</p>
        </div>
        <Link className="button button-secondary desktop-add" href="/tasks">
          <Icon name="plus" size={17} /> Adaugă un task
        </Link>
      </section>

      <section className="dashboard-grid">
        <article className="next-class-card">
          <div className="next-class-top">
            <span className="pill pill-light"><span className="live-dot" /> URMĂTOAREA ORĂ</span>
            <button aria-label="Mai multe opțiuni pentru curs" className="quiet-icon" type="button"><Icon name="more" size={20} /></button>
          </div>
          <div className="next-class-content">
            <div className="class-art"><Icon name="book" size={28} /></div>
            <div>
              <p className="next-class-time"><Icon name="clock" size={15} /> 10:00 — 11:30 <span>· următoarea în program</span></p>
              <h2>Metode empirice în informatică</h2>
              <p className="next-class-meta">Curs · Prof. Andrei Ionescu</p>
            </div>
          </div>
          <div className="next-class-footer">
            <span><Icon name="map" size={16} /> Sala 204 · Facultatea de Matematică</span>
            <Link href="/schedule">Vezi orarul <Icon name="arrow" size={15} /></Link>
          </div>
          <div className="class-decoration class-decoration-one" />
          <div className="class-decoration class-decoration-two" />
        </article>

        <Link className="focus-card" href="/assistant">
          <span className="focus-orbit"><Icon name="sparkles" size={25} /></span>
          <span className="focus-label">STUDY BUDDY</span>
          <strong>Ai nevoie de<br />un plan de studiu?</strong>
          <span className="focus-link">Întreabă Uni <Icon name="arrow" size={15} /></span>
          <span className="focus-decoration">✳</span>
        </Link>
      </section>

      <section className="stats-grid" aria-label="Statistici academice">
        <article className="stat-card">
          <span className="stat-icon stat-violet"><Icon name="check" size={18} /></span>
          <div><p>Task-uri active</p><strong>8</strong><small><span className="trend-up">↑ 2</span> față de săptămâna trecută</small></div>
          <span className="stat-sparkline sparkline-violet" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-green"><Icon name="file" size={18} /></span>
          <div><p>Practice finalizate</p><strong>{completed + 4}<small className="stat-total">/ 8</small></strong><small>Mai ai <b>4</b> de bifat</small></div>
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
          {visibleTasks.map((task) => {
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
                <span className={`task-due${!isDone && task === visibleTasks[0] ? " due-soon" : ""}`}><Icon name="clock" size={14} />{task.date}</span>
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
              <div className="recommendation-copy"><span>{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><Link href="/materials">Află mai multe <Icon name="arrow" size={14} /></Link></div>
              <span className="recommendation-star">✳</span>
            </article>
          ))}
        </div>
      </section>
      <p className="dashboard-footnote">Ai deja bifat {completed + 5} lucruri săptămâna asta. Bravo! <span>✦</span></p>
    </div>
  );
}
