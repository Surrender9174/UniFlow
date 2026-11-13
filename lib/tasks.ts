export type SavedTask = {
  id: string;
  title: string;
  subject: string;
  dueAt: string | null;
  category: "Studiu" | "Practică" | "Test";
  done: boolean;
  createdAt: string;
};

const taskStorageKey = "uniflow-assistant-tasks";
const tasksChangedEvent = "uniflow-assistant-tasks-change";

function isSavedTask(value: unknown): value is SavedTask {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "subject" in value &&
    typeof value.subject === "string" &&
    "dueAt" in value &&
    (value.dueAt === null ||
      (typeof value.dueAt === "string" && Number.isFinite(Date.parse(value.dueAt)))) &&
    "category" in value &&
    (value.category === "Studiu" ||
      value.category === "Practică" ||
      value.category === "Test") &&
    "done" in value &&
    typeof value.done === "boolean" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

export function subscribeToSavedTasks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(tasksChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(tasksChangedEvent, onChange);
  };
}

export function getSavedTasksSnapshot() {
  return window.localStorage.getItem(taskStorageKey) ?? "";
}

export function getServerSavedTasksSnapshot() {
  return "";
}

export function parseSavedTasksSnapshot(snapshot: string): SavedTask[] {
  if (!snapshot) return [];
  const parsed: unknown = JSON.parse(snapshot);
  if (!Array.isArray(parsed) || !parsed.every(isSavedTask)) {
    throw new Error("Task-urile salvate local au un format invalid.");
  }
  return parsed;
}

function saveTasks(tasks: SavedTask[]) {
  window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
  window.dispatchEvent(new Event(tasksChangedEvent));
}

export function addSavedTasks(
  tasks: Array<Omit<SavedTask, "id" | "done" | "createdAt">>,
) {
  const savedTasks = tasks.map((task) => {
    if (task.dueAt === null) {
      return {
        ...task,
        dueAt: null,
        id: crypto.randomUUID(),
        done: false,
        createdAt: new Date().toISOString(),
      };
    }
    const dueAt = new Date(task.dueAt);
    if (!Number.isFinite(dueAt.getTime())) {
      throw new Error("Data și ora task-ului nu sunt valide.");
    }
    return {
      ...task,
      dueAt: dueAt.toISOString(),
      id: crypto.randomUUID(),
      done: false,
      createdAt: new Date().toISOString(),
    };
  });
  if (savedTasks.length > 0) {
    saveTasks([...savedTasks, ...parseSavedTasksSnapshot(getSavedTasksSnapshot())]);
  }
  return savedTasks;
}

export function setSavedTaskDone(id: string, done: boolean) {
  const tasks = parseSavedTasksSnapshot(getSavedTasksSnapshot());
  if (!tasks.some((task) => task.id === id)) {
    throw new Error("Task-ul selectat nu mai există în lista salvată.");
  }
  saveTasks(tasks.map((task) => (task.id === id ? { ...task, done } : task)));
}

export function deleteSavedTask(id: string) {
  const tasks = parseSavedTasksSnapshot(getSavedTasksSnapshot());
  if (!tasks.some((task) => task.id === id)) {
    throw new Error("Task-ul selectat nu mai există în lista salvată.");
  }
  saveTasks(tasks.filter((task) => task.id !== id));
}

export function postponeSavedTask(id: string, dueAt: string) {
  const tasks = parseSavedTasksSnapshot(getSavedTasksSnapshot());
  const task = tasks.find((savedTask) => savedTask.id === id);
  if (!task) {
    throw new Error("Task-ul selectat nu mai există în lista salvată.");
  }

  const newDueAt = new Date(dueAt);
  if (!Number.isFinite(newDueAt.getTime()) || newDueAt.getTime() <= Date.now()) {
    throw new Error("Alege o dată și o oră viitoare.");
  }
  if (task.dueAt && newDueAt.getTime() <= Date.parse(task.dueAt)) {
    throw new Error("Noul termen trebuie să fie după termenul actual.");
  }

  saveTasks(
    tasks.map((savedTask) =>
      savedTask.id === id ? { ...savedTask, dueAt: newDueAt.toISOString() } : savedTask,
    ),
  );
}

export function formatSavedTaskDueAt(dueAt: string | null) {
  if (!dueAt) return "Fără termen";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dueAt));
}
