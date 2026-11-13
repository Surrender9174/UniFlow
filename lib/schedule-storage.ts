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

export function parseScheduleSnapshot(snapshot: string): ScheduleEvent[] {
  return snapshot ? JSON.parse(snapshot) as ScheduleEvent[] : [];
}

export function saveSchedule(events: ScheduleEvent[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(events));
  window.dispatchEvent(new Event(scheduleChangedEvent));
}
