export type StudentProfile = {
  name: string;
  email: string;
  university: string;
  program: string;
  year: string;
};

export const defaultProfile: StudentProfile = {
  name: "Alexandra Popescu",
  email: "alexandra.popescu@student.unibuc.ro",
  university: "Universitatea din București",
  program: "Informatică",
  year: "Anul II",
};

export const profileStorageKey = "uniflow-profile";

const profileChangedEvent = "uniflow-profile-change";

export function subscribeToProfile(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(profileChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(profileChangedEvent, onChange);
  };
}

export function getStoredProfileSnapshot() {
  return window.localStorage.getItem(profileStorageKey) ?? "";
}

export function getServerProfileSnapshot() {
  return "";
}

export function saveProfile(profile: StudentProfile) {
  window.localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  window.dispatchEvent(new Event(profileChangedEvent));
}

export function subscribeToPreferences(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("uniflow-preferences-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("uniflow-preferences-change", onChange);
  };
}

export function getNotificationSnapshot() {
  return window.localStorage.getItem("uniflow-notifications") !== "off" ? "on" : "off";
}

export function getServerNotificationSnapshot() {
  return "on";
}

export function saveNotificationPreference(enabled: boolean) {
  window.localStorage.setItem("uniflow-notifications", enabled ? "on" : "off");
  window.dispatchEvent(new Event("uniflow-preferences-change"));
}
