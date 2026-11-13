"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

const initialTasks = [
  { title: "Eseu: Etica în tehnologie", subject: "Etică profesională", date: "Astăzi · 23:59", category: "Practică", done: false },
  { title: "Laborator — structuri de date", subject: "Algoritmi și structuri de date", date: "Mâine · 12:00", category: "Practică", done: false },
  { title: "Quiz: Baze de date", subject: "Sisteme de gestiune a bazelor de date", date: "Joi · 10:00", category: "Test", done: true },
  { title: "Recapitulare: arbori binari", subject: "Algoritmi și structuri de date", date: "Vineri · 16:00", category: "Studiu", done: false },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const activeCount = tasks.filter((task) => !task.done).length;

  return (
    <div className="section-page">
      <div className="page-heading">
        <div><p className="eyebrow">UN LUCRU PE RÂND</p><h1>Task-urile mele</h1><p className="muted">Ai <strong>{activeCount} task-uri active</strong>. Ești pe drumul cel bun.</p></div>
        <button className="button button-primary" onClick={() => setTasks((current) => [{ title: "Task nou de completat", subject: "Adăugat acum", date: "Alege un termen", category: "Studiu", done: false }, ...current])} type="button"><Icon name="plus" size={17} /> Task nou</button>
      </div>
      <div className="task-filters"><button className="filter-chip selected" type="button">Toate <span>{tasks.length}</span></button><button className="filter-chip" type="button">De făcut <span>{activeCount}</span></button><button className="filter-chip" type="button">Finalizate <span>{tasks.length - activeCount}</span></button></div>
      <section className="card-surface tasks-full-list">{tasks.map((task, index) => <article className={`task-row${task.done ? " task-done" : ""}`} key={`${task.title}-${index}`}><button aria-label={task.done ? "Marchează ca nefinalizat" : "Marchează ca finalizat"} aria-pressed={task.done} className={`task-check ${task.done ? "checked" : ""}`} onClick={() => setTasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item))} type="button">{task.done && <Icon name="check" size={13} />}</button><span className={`task-color ${index % 2 ? "mint" : "lavender"}`} /><div className="task-description"><strong>{task.title}</strong><small>{task.subject}</small></div><span className="task-category">{task.category}</span><span className={`task-due${!task.done && index === 0 ? " due-soon" : ""}`}><Icon name="clock" size={14} />{task.date}</span><button aria-label="Mai multe opțiuni" className="quiet-icon task-more" type="button"><Icon name="more" size={18} /></button></article>)}</section>
    </div>
  );
}
