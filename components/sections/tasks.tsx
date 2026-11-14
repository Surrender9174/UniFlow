"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
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

type TaskFilter = "all" | "active" | "done";

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
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const postponeInput = useRef<HTMLInputElement>(null);
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
  const completedCount = taskRows.length - activeCount;
  const visibleTasks = taskRows.filter((task) => {
    if (taskFilter === "active") return !task.done;
    if (taskFilter === "done") return task.done;
    return true;
  });

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

  const completeTask = (task: TaskRow) => {
    setStorageError("");
    try {
      if (!task.done) setSavedTaskDone(task.id, true);
      setFlashcardTaskId(null);
      setFlashcardResponse("");
      setShowFlashcardAnswer(false);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut finaliza task-ul.",
      );
    }
  };

  const openFlashcardTask = taskRows.find((task) => task.id === flashcardTaskId);
  const openFlashcards = openFlashcardTask?.flashcards ?? [];
  const activeFlashcard = openFlashcards[flashcardIndex] ?? null;

  const postponeTask = (event: FormEvent<HTMLFormElement>, task: TaskRow) => {
    event.preventDefault();
    setStorageError("");
    try {
      const selectedDueAt = new FormData(event.currentTarget).get("dueAt");
      if (typeof selectedDueAt !== "string" || !selectedDueAt) {
        throw new Error("Alege o dată și o oră valide.");
      }
      const newDueAt = new Date(selectedDueAt);
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
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Nu am putut amâna task-ul.",
      );
    }
  };

  const openPostponeDatePicker = () => {
    const input = postponeInput.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
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
        <button
          aria-pressed={taskFilter === "all"}
          className={`filter-chip${taskFilter === "all" ? " selected" : ""}`}
          onClick={() => setTaskFilter("all")}
          type="button"
        >
          Toate <span>{taskRows.length}</span>
        </button>
        <button
          aria-pressed={taskFilter === "active"}
          className={`filter-chip${taskFilter === "active" ? " selected" : ""}`}
          onClick={() => setTaskFilter("active")}
          type="button"
        >
          De făcut <span>{activeCount}</span>
        </button>
        <button
          aria-pressed={taskFilter === "done"}
          className={`filter-chip${taskFilter === "done" ? " selected" : ""}`}
          onClick={() => setTaskFilter("done")}
          type="button"
        >
          Finalizate <span>{completedCount}</span>
        </button>
      </div>
      <section
        className={`card-surface tasks-full-list${visibleTasks.length === 0 ? " tasks-empty-list" : ""}`}
        aria-label={
          taskFilter === "active"
            ? "Task-uri de făcut"
            : taskFilter === "done"
              ? "Task-uri finalizate"
              : "Toate task-urile"
        }
      >
        {visibleTasks.length === 0 && (
          <div className="schedule-empty tasks-empty-state" role="status">
            <Icon name="check" size={20} />
            <p>
              {taskFilter === "active"
                ? "Nu ai task-uri de făcut."
                : taskFilter === "done"
                  ? "Nu ai task-uri finalizate încă."
                  : "Nu ai task-uri salvate încă. Cere-i asistentului să adauge unul."}
            </p>
          </div>
        )}
        {visibleTasks.map((task, index) => (
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
                    <label htmlFor={`postpone-${task.id}`}>
                      {task.dueAt ? "Amână până la" : "Data și ora task-ului"}
                    </label>
                    <button
                      aria-controls={`postpone-${task.id}`}
                      className="task-date-picker-button"
                      onClick={openPostponeDatePicker}
                      type="button"
                    >
                      <Icon name="calendar" size={14} />
                      {task.dueAt ? "Schimbă data și ora" : "Alege data și ora"}
                    </button>
                    <input
                      id={`postpone-${task.id}`}
                      min={postponeMinimum}
                      name="dueAt"
                      ref={postponeInput}
                      required
                      type="datetime-local"
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
                  {flashcardIndex < openFlashcards.length - 1 ? (
                    <button
                      className="button button-secondary"
                      onClick={() => moveFlashcard(1)}
                      type="button"
                    >
                      Următorul
                    </button>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={task.done}
                      onClick={() => completeTask(task)}
                      type="button"
                    >
                      {task.done ? "Task completat" : "Completează taskul"}
                    </button>
                  )}
                </div>
              </section>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
