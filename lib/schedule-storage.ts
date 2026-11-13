export type ScheduleEvent = {
  id: string;
  weekday: number;
  start: string;
  end: string;
  title: string;
  type: string;
  room: string;
};

const storageKey = "uniflow-schedule";
const scheduleChangedEvent = "uniflow-schedule-change";

export function subscribeToSchedule(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(scheduleChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(scheduleChangedEvent, onChange);
  };
}

export function getStoredScheduleSnapshot() {
  return window.localStorage.getItem(storageKey) ?? "";
}

export function getServerScheduleSnapshot() {
  return "";
}

function isScheduleEvent(value: unknown): value is ScheduleEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "weekday" in value &&
    typeof value.weekday === "number" &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    "start" in value &&
    typeof value.start === "string" &&
    /^\d{2}:\d{2}$/.test(value.start) &&
    "end" in value &&
    typeof value.end === "string" &&
    /^\d{2}:\d{2}$/.test(value.end) &&
    "title" in value &&
    typeof value.title === "string" &&
    "type" in value &&
    typeof value.type === "string" &&
    "room" in value &&
    typeof value.room === "string"
  );
}

export function parseScheduleSnapshot(snapshot: string): ScheduleEvent[] {
  if (!snapshot) return [];
  const parsed: unknown = JSON.parse(snapshot);
  if (!Array.isArray(parsed) || !parsed.every(isScheduleEvent)) {
    throw new Error("Orarul salvat local are un format invalid.");
  }
  return parsed;
}

export function saveSchedule(events: ScheduleEvent[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(events));
  window.dispatchEvent(new Event(scheduleChangedEvent));
}
