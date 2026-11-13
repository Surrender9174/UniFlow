"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Icon } from "@/components/icons";
import {
  formatSavedTaskDueAt,
  deleteSavedTask,
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  postponeSavedTask,
  setSavedTaskDone,
  subscribeToSavedTasks,
} from "@/lib/tasks";

type DemoTask = {
  title: string;
  subject: string;
  date: string;
  category: "Studiu" | "Practică" | "Test";
  done: boolean;
  dueAt?: string | null;
};

const initialTasks: DemoTask[] = [
  { title: "Eseu: Etica în tehnologie", subject: "Etică profesională", date: "Astăzi · 23:59", category: "Practică", done: false },
  { title: "Laborator — structuri de date", subject: "Algoritmi și structuri de date", date: "Mâine · 12:00", category: "Practică", done: false },
  { title: "Quiz: Baze de date", subject: "Sisteme de gestiune a bazelor de date", date: "Joi · 10:00", category: "Test", done: true },
  { title: "Recapitulare: arbori binari", subject: "Algoritmi și structuri de date", date: "Vineri · 16:00", category: "Studiu", done: false },
];

type TaskRow = DemoTask & {
  id: string;
  savedId?: string;
  demoIndex?: number;
  dueAt?: string | null;
};

function formatLocalDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getPostponeMinimum(dueAt: string | null | undefined) {
  const currentDueAt = dueAt ? Date.parse(dueAt) : 0;
  const minimum = Math.max(Date.now(), currentDueAt) + 60_000;
  return formatLocalDateTimeInput(new Date(minimum));
}

export default function TasksPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [storageError, setStorageError] = useState("");
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [postponeMinimum, setPostponeMinimum] = useState("");
  const [postponeValue, setPostponeValue] = useState("");
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
  const taskRows: TaskRow[] = [
    ...savedTasks.map((task) => ({
      id: task.id,
      savedId: task.id,
      title: task.title,
      subject: task.subject,
      date: formatSavedTaskDueAt(task.dueAt),
      category: task.category,
      done: task.done,
      dueAt: task.dueAt,
    })),
    ...tasks.map((task, index) => ({
      id: `demo-${index}`,
      demoIndex: index,
      ...task,
    })),
  ];
  const activeCount = taskRows.filter((task) => !task.done).length;

  const toggleTask = (task: TaskRow) => {
    setStorageError("");
    if (task.savedId) {
      try {
        setSavedTaskDone(task.savedId, !task.done);
      } catch (error) {
        setStorageError(
          error instanceof Error ? error.message : "Nu am putut actualiza task-ul.",
        );
      }
      return;
    }
    if (task.demoIndex !== undefined) {
      setTasks((current) =>
        current.map((item, index) =>
          index === task.demoIndex ? { ...item, done: !item.done } : item,
        ),
      );
    }
  };

  const toggleTaskActions = (task: TaskRow) => {
    setStorageError("");
    if (actionTaskId === task.id) {
      setActionTaskId(null);
      return;
    }
    setActionTaskId(task.id);
    setPostponeMinimum(getPostponeMinimum(task.dueAt));
    setPostponeValue("");
  };

  const deleteTask = (task: TaskRow) => {
    setStorageError("");
    try {
      if (task.savedId) {
        deleteSavedTask(task.savedId);
      } else if (task.demoIndex !== undefined) {
        setTasks((current) => current.filter((_, index) => index !== task.demoIndex));
      }
      setActionTaskId(null);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut șterge task-ul.",
      );
    }
  };

  const postponeTask = (event: FormEvent<HTMLFormElement>, task: TaskRow) => {
    event.preventDefault();
    setStorageError("");
    try {
      const newDueAt = new Date(postponeValue);
      if (!Number.isFinite(newDueAt.getTime())) {
        throw new Error("Alege o dată și o oră valide.");
      }
      const dueAt = newDueAt.toISOString();
      if (newDueAt.getTime() <= Date.now()) {
        throw new Error("Alege o dată și o oră viitoare.");
      }
      if (task.dueAt && newDueAt.getTime() <= Date.parse(task.dueAt)) {
        throw new Error("Noul termen trebuie să fie după termenul actual.");
      }
      if (task.savedId) {
        postponeSavedTask(task.savedId, dueAt);
      } else if (task.demoIndex !== undefined) {
        setTasks((current) =>
          current.map((item, index) =>
            index === task.demoIndex
              ? { ...item, dueAt, date: formatSavedTaskDueAt(dueAt) }
              : item,
          ),
        );
      }
      setActionTaskId(null);
      setPostponeValue("");
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut amâna task-ul.",
      );
    }
  };

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN LUCRU PE RÂND</p>
          <h1>Task-urile mele</h1>
          <p className="muted">
            Ai <strong>{activeCount} task-uri active</strong>. Ești pe drumul cel bun.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() =>
            setTasks((current) => [
              {
                title: "Task nou de completat",
                subject: "Adăugat acum",
                date: "Alege un termen",
                category: "Studiu",
                done: false,
              },
              ...current,
            ])
          }
          type="button"
        >
          <Icon name="plus" size={17} /> Task nou
        </button>
      </div>
      {savedTasksError && <p className="gmail-status-error" role="alert">{savedTasksError}</p>}
      {storageError && <p className="gmail-status-error" role="alert">{storageError}</p>}
      <div className="task-filters">
        <button className="filter-chip selected" type="button">
          Toate <span>{taskRows.length}</span>
        </button>
        <button className="filter-chip" type="button">
          De făcut <span>{activeCount}</span>
        </button>
        <button className="filter-chip" type="button">
          Finalizate <span>{taskRows.length - activeCount}</span>
        </button>
      </div>
      <section className="card-surface tasks-full-list">
        {taskRows.map((task, index) => (
          <article
            className={`task-row${task.done ? " task-done" : ""}${actionTaskId === task.id ? " task-row-actions-open" : ""}`}
            key={task.id}
          >
            <button
              aria-label={task.done ? "Marchează ca nefinalizat" : "Marchează ca finalizat"}
              aria-pressed={task.done}
              className={`task-check ${task.done ? "checked" : ""}`}
              onClick={() => toggleTask(task)}
              type="button"
            >
              {task.done && <Icon name="check" size={13} />}
            </button>
            <span className={`task-color ${index % 2 ? "mint" : "lavender"}`} />
            <div className="task-description">
              <strong>{task.title}</strong>
              <small>{task.subject}</small>
            </div>
            <span className="task-category">{task.category}</span>
            <span className={`task-due${!task.done && index === 0 && task.date !== "Fără termen" ? " due-soon" : ""}`}>
              <Icon name="clock" size={14} />{task.date}
            </span>
            {(task.savedId || task.demoIndex !== undefined) && (
              <div className="task-actions">
                <button
                  aria-controls={`task-actions-${task.id}`}
                  aria-expanded={actionTaskId === task.id}
                  aria-label="Mai multe opțiuni"
                  className="quiet-icon task-more"
                  onClick={() => toggleTaskActions(task)}
                  type="button"
                >
                  <Icon name="more" size={18} />
                </button>
                {actionTaskId === task.id && (
                  <div className="task-action-panel" id={`task-actions-${task.id}`}>
                    <button
                      className="task-action-delete"
                      onClick={() => deleteTask(task)}
                      type="button"
                    >
                      Șterge task-ul
                    </button>
                    <form onSubmit={(event) => postponeTask(event, task)}>
                      <label htmlFor={`postpone-${task.id}`}>Amână până la</label>
                      <input
                        id={`postpone-${task.id}`}
                        min={postponeMinimum}
                        onChange={(event) => setPostponeValue(event.target.value)}
                        required
                        type="datetime-local"
                        value={postponeValue}
                      />
                      <button className="button button-primary" type="submit">
                        Salvează noul termen
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
