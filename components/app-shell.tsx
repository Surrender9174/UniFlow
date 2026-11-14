"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import ThemeToggle from "@/components/theme-toggle";
import { syncAuthenticatedProfile } from "@/lib/auth-profile";
import {
  defaultProfile,
  getServerProfileSnapshot,
  getServerThemeSnapshot,
  getThemeSnapshot,
  getStoredProfileSnapshot,
  subscribeToProfile,
  subscribeToPreferences,
  type StudentProfile,
} from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getAcademicYearLabel } from "@/lib/device-time";
import { useDeviceNow } from "@/components/use-device-now";
import QueueLessActiveTicket from "@/components/queueless-active-ticket";
import {
  getSavedTasksSnapshot,
  getServerSavedTasksSnapshot,
  parseSavedTasksSnapshot,
  subscribeToSavedTasks,
  type SavedTask,
} from "@/lib/tasks";

const navigation = [
  { href: "/dashboard", label: "Acasă" },
  { href: "/schedule", label: "Orar" },
  { href: "/tasks", label: "Task-uri" },
  { href: "/assistant", label: "Asistent" },
  { href: "/skillswap", label: "SkillSwap" },
  { href: "/queueless", label: "QueueLess" },
  { href: "/profile", label: "Profil" },
];

type AppNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
};

function formatTimeUntil(dueAt: string, now: Date) {
  const minutes = Math.max(1, Math.ceil((Date.parse(dueAt) - now.getTime()) / 60_000));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days} z · ${hours} h`;
  if (hours) return `${hours} h${remainingMinutes ? ` ${remainingMinutes} min` : ""}`;
  return `${remainingMinutes} min`;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const now = useDeviceNow();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated" | "error">("loading");
  const [authError, setAuthError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [gmailNotifications, setGmailNotifications] = useState<AppNotification[]>([]);
  const [unreadGmailCount, setUnreadGmailCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");
  const savedTheme = useSyncExternalStore(
    subscribeToPreferences,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
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
  const taskData = useMemo(() => {
    try {
      return { tasks: parseSavedTasksSnapshot(taskSnapshot), error: "" };
    } catch (error) {
      return {
        tasks: [],
        error: error instanceof Error ? error.message : "Nu am putut citi task-urile.",
      };
    }
  }, [taskSnapshot]);
  const activeTaskCount = taskData.tasks.filter((task) => !task.done).length;
  const upcomingDeadlines = useMemo(() => {
    if (!now) return [];
    const maximum = now.getTime() + 24 * 60 * 60 * 1_000;
    return taskData.tasks
      .filter(
        (task): task is SavedTask & { dueAt: string } =>
          !task.done &&
          typeof task.dueAt === "string" &&
          Date.parse(task.dueAt) > now.getTime() &&
          Date.parse(task.dueAt) <= maximum,
      )
      .sort((left, right) => (left.dueAt ?? "").localeCompare(right.dueAt ?? ""));
  }, [now, taskData.tasks]);
  const notificationCount = unreadGmailCount + upcomingDeadlines.length;
  const profile: StudentProfile = savedProfile
    ? { ...defaultProfile, ...JSON.parse(savedProfile) as Partial<StudentProfile> }
    : defaultProfile;
  const name = profile.name || defaultProfile.name;

  useEffect(() => {
    document.documentElement.dataset.theme = savedTheme;
  }, [savedTheme]);

  useEffect(() => {
    if (pathname === "/" || pathname === "/auth" || pathname.startsWith("/auth/")) return;

    if (!supabase) {
      router.replace("/auth");
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (session?.user) {
        syncAuthenticatedProfile(session.user);
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
        router.replace("/auth");
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuthError(error.message);
          setAuthState("error");
        } else if (data.session?.user) {
          syncAuthenticatedProfile(data.session.user);
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
          router.replace("/auth");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(
          error instanceof Error ? error.message : "Nu am putut verifica sesiunea.",
        );
        setAuthState("error");
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  useEffect(() => {
    if (authState !== "authenticated" || !supabase) return;

    const client = supabase;
    let active = true;
    const loadNotifications = async () => {
      const [notificationsResult, unreadResult] = await Promise.all([
        client
          .from("app_notifications")
          .select("id, title, body, href, read_at")
          .order("created_at", { ascending: false })
          .limit(30),
        client
          .from("app_notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);
      if (!active) return;
      if (notificationsResult.error || unreadResult.error) {
        setNotificationError(
          notificationsResult.error?.message ??
            unreadResult.error?.message ??
            "Nu am putut încărca notificările.",
        );
        return;
      }
      setNotificationError("");
      setGmailNotifications(notificationsResult.data ?? []);
      setUnreadGmailCount(unreadResult.count ?? 0);
    };

    void loadNotifications();
    const intervalId = window.setInterval(() => void loadNotifications(), 60_000);
    window.addEventListener("focus", loadNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [authState]);

  const markNotificationRead = async (notification: AppNotification) => {
    if (!supabase || notification.read_at) return;
    try {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("app_notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id);
      if (error) throw error;
      setUnreadGmailCount((count) => Math.max(0, count - 1));
      setGmailNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read_at: readAt } : item,
        ),
      );
    } catch (error) {
      setNotificationError(
        error instanceof Error ? error.message : "Nu am putut marca notificarea ca citită.",
      );
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;

    setSigningOut(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/auth");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Nu te-ai putut deconecta.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  if (isAuthRoute || pathname === "/") return children;

  return (
    <>
    <div className="app-frame" hidden={authState !== "authenticated"}>
      <aside className="sidebar">
        <Link className="brand" href="/dashboard" aria-label="UniFlow, pagina principală">
          <span className="brand-mark"><Icon name="logo" size={20} /></span>
          <span>uni<span>flow</span></span>
        </Link>
        <p className="sidebar-caption">SPAȚIUL TĂU</p>
        <nav className="sidebar-nav" aria-label="Navigare principală">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-link${active ? " active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <span>{item.label}</span>
                {item.href === "/tasks" && (
                  <span aria-label={`${activeTaskCount} task-uri active`} className="nav-count">
                    {activeTaskCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-ingestion" href="/materials">
            <span className="ingestion-icon"><Icon name="upload" size={18} /></span>
            <span><strong>Încarcă materiale</strong><small>PDF → plan de studiu</small></span>
            <Icon name="chevron" size={16} />
          </Link>
          <Link className="sidebar-profile" href="/profile">
            <span className="avatar avatar-small">{name.slice(0, 1).toUpperCase()}</span>
            <span className="profile-summary"><strong>{name}</strong><small>Cont student</small></span>
            <Icon name="more" size={18} />
          </Link>
          {authError && <p className="sidebar-auth-error" role="alert">{authError}</p>}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><Icon name="logo" size={18} /></span>
            <span>uni<span>flow</span></span>
          </div>
          <div className="topbar-context"><span>{profile.semester}</span><span className="context-dot" /> {now ? getAcademicYearLabel(now) : "—"}</div>
          <div className="topbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input aria-label="Caută în UniFlow" placeholder="Caută orice..." />
            </label>
            <ThemeToggle />
            <div className="notification-wrap">
              <button
                aria-controls="notification-panel"
                aria-expanded={notificationsOpen}
                aria-label={`Notificări${notificationCount ? `, ${notificationCount} noi` : ""}`}
                className="icon-button notification-button"
                onClick={() => setNotificationsOpen((open) => !open)}
                type="button"
              >
                <Icon name="bell" size={19} />
                {notificationCount > 0 && (
                  <span>{notificationCount > 99 ? "99+" : notificationCount}</span>
                )}
              </button>
              {notificationsOpen && (
                <div
                  aria-label="Centrul de notificări"
                  className="notification-panel"
                  id="notification-panel"
                >
                  <div className="notification-panel-heading">
                    <strong>Notificări</strong>
                    <button onClick={() => setNotificationsOpen(false)} type="button">
                      Închide
                    </button>
                  </div>
                  {notificationError && (
                    <p className="notification-error" role="alert">{notificationError}</p>
                  )}
                  {taskData.error && (
                    <p className="notification-error" role="alert">{taskData.error}</p>
                  )}
                  {now && upcomingDeadlines.length > 0 && (
                    <section className="notification-section">
                      <strong>Termene apropiate</strong>
                      {upcomingDeadlines.map((task) => (
                        <Link
                          className="notification-item"
                          href="/tasks"
                          key={`${task.id}-${task.dueAt}`}
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <span className="notification-dot deadline" />
                          <span>
                            <strong>{task.title}</strong>
                            <small>
                              Mai ai {formatTimeUntil(task.dueAt, now)} · {task.subject}
                            </small>
                          </span>
                        </Link>
                      ))}
                    </section>
                  )}
                  <section className="notification-section">
                    <strong>Actualizări Gmail</strong>
                    {gmailNotifications.length ? (
                      gmailNotifications.map((notification) => (
                        <Link
                          className={`notification-item${notification.read_at ? "" : " unread"}`}
                          href={notification.href || "/assistant"}
                          key={notification.id}
                          onClick={() => {
                            void markNotificationRead(notification);
                            setNotificationsOpen(false);
                          }}
                        >
                          <span className="notification-dot gmail" />
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.body}</small>
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="notification-empty">Nu există noutăți Gmail.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
            <button
              className="topbar-logout"
              disabled={signingOut}
              onClick={handleLogout}
              type="button"
            >
              {signingOut ? "..." : "Ieșire"}
            </button>
            <Link aria-label="Deschide profilul" className="avatar avatar-top" href="/profile">
              {name.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        {authError && <p className="topbar-auth-error" role="alert">{authError}</p>}

        <main className="page-content" key={pathname}>
          <div className="page-enter">{children}</div>
        </main>
      </div>

      <nav aria-label="Navigare mobilă" className="bottom-nav">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`bottom-nav-link${active ? " active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {authState === "authenticated" && <QueueLessActiveTicket />}
    </div>
    {authState === "error" ? (
      <main className="auth-gate-error" role="alert">
        <p>Nu am putut verifica sesiunea: {authError}</p>
        <Link className="button button-primary" href="/auth">Continuă către autentificare</Link>
      </main>
    ) : authState !== "authenticated" ? (
      <main className="auth-gate-loading" aria-label="Se verifică sesiunea" />
    ) : null}
    </>
  );
}
