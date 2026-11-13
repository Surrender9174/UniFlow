"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { syncAuthenticatedProfile } from "@/lib/auth-profile";
import {
  defaultProfile,
  getServerProfileSnapshot,
  getStoredProfileSnapshot,
  subscribeToProfile,
} from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useEffect, useState, useSyncExternalStore } from "react";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Acasă", icon: "home" },
  { href: "/schedule", label: "Orar", icon: "calendar" },
  { href: "/tasks", label: "Task-uri", icon: "check" },
  { href: "/assistant", label: "Asistent", icon: "sparkles" },
  { href: "/profile", label: "Profil", icon: "user" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated" | "error">("loading");
  const [authError, setAuthError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const savedProfile = useSyncExternalStore(
    subscribeToProfile,
    getStoredProfileSnapshot,
    getServerProfileSnapshot,
  );
  const name = savedProfile
    ? (JSON.parse(savedProfile) as { name?: string }).name ?? defaultProfile.name
    : defaultProfile.name;

  useEffect(() => {
    if (pathname === "/auth") return;

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

  if (pathname === "/auth") return children;
  if (authState === "loading" || authState === "unauthenticated") {
    return <main className="auth-gate-loading" aria-label="Se verifică sesiunea" />;
  }
  if (authState === "error") {
    return (
      <main className="auth-gate-error" role="alert">
        <p>Nu am putut verifica sesiunea: {authError}</p>
        <Link className="button button-primary" href="/auth">Continuă către autentificare</Link>
      </main>
    );
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="UniFlow, pagina principală">
          <span className="brand-mark"><Icon name="sparkles" size={20} /></span>
          <span>uni<span>flow</span></span>
        </Link>
        <p className="sidebar-caption">SPAȚIUL TĂU</p>
        <nav className="sidebar-nav" aria-label="Navigare principală">
          {navigation.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`nav-link${active ? " active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                {item.href === "/tasks" && <span className="nav-count">3</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-ingestion" href="/materials">
            <span className="ingestion-icon"><Icon name="upload" size={18} /></span>
            <span><strong>Importă materiale</strong><small>PDF → plan de studiu</small></span>
            <Icon name="chevron" size={16} />
          </Link>
          <Link className="sidebar-profile" href="/profile">
            <span className="avatar avatar-small">{name.slice(0, 1).toUpperCase()}</span>
            <span className="profile-summary"><strong>{name}</strong><small>Cont student</small></span>
            <Icon name="more" size={18} />
          </Link>
          <button
            className="sidebar-logout"
            disabled={signingOut}
            onClick={handleLogout}
            type="button"
          >
            {signingOut ? "Se deconectează..." : "Deconectare"}
          </button>
          {authError && <p className="sidebar-auth-error" role="alert">{authError}</p>}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><Icon name="sparkles" size={18} /></span>
            <span>uni<span>flow</span></span>
          </div>
          <div className="topbar-context"><span>Semestrul II</span><span className="context-dot" /> 2025–2026</div>
          <div className="topbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input aria-label="Caută în UniFlow" placeholder="Caută orice..." />
              <kbd>⌘ K</kbd>
            </label>
            <button aria-label="Notificări" className="icon-button notification-button" type="button">
              <Icon name="bell" size={19} /><span />
            </button>
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
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`bottom-nav-link${active ? " active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
