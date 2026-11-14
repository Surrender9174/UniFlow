"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import {
  addSavedTasks,
  deleteSavedTask,
  formatSavedTaskDueAt,
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  postponeSavedTask,
  setSavedTaskDone,
  subscribeToSavedTasks,
  type SavedFlashcard,
} from "@/lib/tasks";

type TaskRow = {
  id: string;
  title: string;
  subject: string;
  date: string;
  dueAt: string | null;
  category: "Studiu" | "Practică" | "Test";
  done: boolean;
  topic?: string;
  flashcards?: SavedFlashcard[];
};

function formatLocalDateTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getPostponeMinimum(dueAt: string | null) {
  const currentDueAt = dueAt ? Date.parse(dueAt) : 0;
  const minimum = Math.max(Date.now(), currentDueAt) + 60_000;
  return formatLocalDateTimeInput(new Date(minimum));
}

export default function TasksPage() {
  const [storageError, setStorageError] = useState("");
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [postponeMinimum, setPostponeMinimum] = useState("");
  const [postponeValue, setPostponeValue] = useState("");
  const [flashcardTaskId, setFlashcardTaskId] = useState<string | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [flashcardResponse, setFlashcardResponse] = useState("");
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
  const taskRows: TaskRow[] = savedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      subject: task.subject,
      date: formatSavedTaskDueAt(task.dueAt),
      dueAt: task.dueAt,
      category: task.category,
      done: task.done,
      topic: task.topic,
      flashcards: task.flashcards,
  }));
  const activeCount = savedTasks.filter((task) => !task.done).length;

  const toggleTask = (task: TaskRow) => {
    setStorageError("");
    try {
      setSavedTaskDone(task.id, !task.done);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut actualiza task-ul.",
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
      deleteSavedTask(task.id);
      setActionTaskId(null);
      if (flashcardTaskId === task.id) setFlashcardTaskId(null);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut șterge task-ul.",
      );
    }
  };

  const toggleFlashcards = (task: TaskRow) => {
    if (!task.flashcards?.length) return;
    if (flashcardTaskId === task.id) {
      setFlashcardTaskId(null);
      setFlashcardResponse("");
      setShowFlashcardAnswer(false);
      return;
    }
    setFlashcardTaskId(task.id);
    setFlashcardIndex(0);
    setFlashcardResponse("");
    setShowFlashcardAnswer(false);
  };

  const moveFlashcard = (direction: -1 | 1) => {
    setFlashcardIndex((current) => current + direction);
    setFlashcardResponse("");
    setShowFlashcardAnswer(false);
  };

  const openFlashcardTask = taskRows.find((task) => task.id === flashcardTaskId);
  const openFlashcards = openFlashcardTask?.flashcards ?? [];
  const activeFlashcard = openFlashcards[flashcardIndex] ?? null;

  const postponeTask = (event: FormEvent<HTMLFormElement>, task: TaskRow) => {
    event.preventDefault();
    setStorageError("");
    try {
      const newDueAt = new Date(postponeValue);
      if (!Number.isFinite(newDueAt.getTime())) {
        throw new Error("Alege o dată și o oră valide.");
      }
      if (newDueAt.getTime() <= Date.now()) {
        throw new Error("Alege o dată și o oră viitoare.");
      }
      if (task.dueAt && newDueAt.getTime() <= Date.parse(task.dueAt)) {
        throw new Error("Noul termen trebuie să fie după termenul actual.");
      }
      postponeSavedTask(task.id, newDueAt.toISOString());
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
          onClick={() => {
            setStorageError("");
            try {
              addSavedTasks([
                {
                  title: "Task nou de completat",
                  subject: "Adăugat manual",
                  dueAt: null,
                  category: "Studiu",
                },
              ]);
            } catch (error) {
              setStorageError(
                error instanceof Error ? error.message : "Nu am putut crea task-ul.",
              );
            }
          }}
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
        {taskRows.length === 0 && (
          <div className="schedule-empty">
            <Icon name="check" size={20} />
            <p>Nu ai task-uri salvate încă. Cere-i asistentului să adauge unul.</p>
          </div>
        )}
        {taskRows.map((task, index) => (
          <article
            className="task-entry"
            key={task.id}
          >
            <div className={`task-row${task.done ? " task-done" : ""}${actionTaskId === task.id ? " task-row-actions-open" : ""}`}>
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
                {task.flashcards?.length ? (
                  <button
                    aria-controls={`task-flashcards-${task.id}`}
                    aria-expanded={flashcardTaskId === task.id}
                    className="task-title-button"
                    onClick={() => toggleFlashcards(task)}
                    type="button"
                  >
                    <strong>{task.title}</strong>
                    <small>
                      {task.subject} · {task.flashcards.length} flashcarduri · Apasă pentru a studia
                    </small>
                  </button>
                ) : (
                  <>
                    <strong>{task.title}</strong>
                    <small>{task.subject}</small>
                  </>
                )}
              </div>
              <span className="task-category">{task.category}</span>
              <span className={`task-due${!task.done && index === 0 && task.date !== "Fără termen" ? " due-soon" : ""}`}>
                <Icon name="clock" size={14} />{task.date}
              </span>
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
            </div>
            {flashcardTaskId === task.id && activeFlashcard && (
              <section
                aria-label={`Flashcarduri pentru ${task.topic ?? task.title}`}
                className="task-flashcards"
                id={`task-flashcards-${task.id}`}
              >
                <div className="task-flashcards-heading">
                  <strong>Flashcard {flashcardIndex + 1} din {openFlashcards.length}</strong>
                  <button
                    onClick={() => {
                      setFlashcardTaskId(null);
                      setFlashcardResponse("");
                      setShowFlashcardAnswer(false);
                    }}
                    type="button"
                  >
                    Închide
                  </button>
                </div>
                <div className="task-flashcard">
                  <span>ÎNTREBARE</span>
                  <p>{activeFlashcard.question}</p>
                  <label className="task-flashcard-response">
                    <span>RĂSPUNSUL TĂU</span>
                    <textarea
                      disabled={showFlashcardAnswer}
                      onChange={(event) => setFlashcardResponse(event.target.value)}
                      placeholder="Scrie răspunsul înainte să verifici..."
                      rows={3}
                      value={flashcardResponse}
                    />
                  </label>
                  {showFlashcardAnswer ? (
                    <>
                      <div className="task-flashcard-answer">
                        <span>RĂSPUNS AȘTEPTAT</span>
                        <p>{activeFlashcard.answer}</p>
                      </div>
                      <p className="task-flashcard-self-check">
                        Compară răspunsul tău cu cel așteptat, apoi continuă.
                      </p>
                    </>
                  ) : (
                    <button
                      className="button button-secondary"
                      disabled={!flashcardResponse.trim()}
                      onClick={() => setShowFlashcardAnswer(true)}
                      type="button"
                    >
                      Verifică răspunsul
                    </button>
                  )}
                </div>
                <div className="task-flashcard-navigation">
                  <button
                    className="button button-secondary"
                    disabled={flashcardIndex === 0}
                    onClick={() => moveFlashcard(-1)}
                    type="button"
                  >
                    Înapoi
                  </button>
                  <button
                    className="button button-secondary"
                    disabled={flashcardIndex >= openFlashcards.length - 1}
                    onClick={() => moveFlashcard(1)}
                    type="button"
                  >
                    Următorul
                  </button>
                </div>
              </section>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
