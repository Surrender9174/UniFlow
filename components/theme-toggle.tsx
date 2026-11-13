"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  saveThemePreference,
  subscribeToPreferences,
} from "@/lib/profile";

export default function ThemeToggle({
  variant = "default",
}: {
  variant?: "default" | "accent";
}) {
  const theme = useSyncExternalStore(
    subscribeToPreferences,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const isDark = theme === "dark";
  const label = isDark ? "Activează tema luminoasă" : "Activează tema întunecată";

  return (
    <button
      aria-label={label}
      aria-pressed={isDark}
      className={`theme-toggle${variant === "accent" ? " theme-toggle-accent" : ""}`}
      onClick={() => saveThemePreference(isDark ? "light" : "dark")}
      title={label}
      type="button"
    >
      <Icon name={isDark ? "sun" : "moon"} size={18} />
    </button>
  );
}
