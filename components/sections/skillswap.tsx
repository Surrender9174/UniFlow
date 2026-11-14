"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useDeviceNow } from "@/components/use-device-now";
import { supabase } from "@/lib/supabase";
import {
  fetchSkillSwapApi,
  formatAvailabilityTime,
  formatSkillSwapTime,
  getLocalDateTimeInputValue,
  localDateTimeToIso,
} from "@/lib/skillswap/client";
import { getSuggestedSkillPath } from "@/lib/skillswap/skill-tree";
import {
  skillCategories,
  skillLevels,
  type AvailabilitySlot,
  type CycleMatch,
  type DirectMatch,
  type MatchRecommendation,
  type SkillCategory,
  type SkillDirection,
  type SkillLevel,
  type SkillSwapProfile,
  type SkillSwapSession,
  type SkillSwapSkill,
} from "@/lib/skillswap/types";

type ProfileResponse = { profile: SkillSwapProfile | null };
type MatchesResponse = {
  profileComplete: boolean;
  matches: MatchRecommendation[];
};
type SessionsResponse = { sessions: SkillSwapSession[] };
type Notification = {
  id: string;
  session_id: string | null;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
type NotificationsResponse = { notifications: Notification[] };
type Verification = {
  id: string;
  user_id: string;
  skill_id: string;
  submission_type: "quiz" | "portfolio";
  evidence: string;
  status: "pending" | "approved" | "rejected";
  review_note: string;
  created_at: string;
  displayName: string;
  skillName: string;
};
type VerificationsResponse = { submissions: Verification[] };
type ProposalTarget =
  | { kind: "direct"; match: DirectMatch }
  | { kind: "cycle"; match: CycleMatch };

const weekdays = [
  "Duminică",
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
];

const sessionStatusLabels: Record<SkillSwapSession["status"], string> = {
  requested: "În așteptare",
  accepted: "Confirmată",
  declined: "Refuzată",
  cancelled: "Anulată",
  awaiting_confirmation: "Așteaptă confirmarea",
  completed: "Încheiată",
  disputed: "În analiză",
};

function createEmptyProfile(displayName: string, timezone: string): SkillSwapProfile {
  return {
    displayName,
    bio: "",
    timezone,
    skills: [],
    availability: [],
    verifiedSkills: [],
  };
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDefaultDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const name = user.user_metadata?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return user.email?.split("@")[0] || "Membru SkillSwap";
}

export default function SkillSwapSection() {
  const now = useDeviceNow();
  const [profile, setProfile] = useState<SkillSwapProfile | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [userId, setUserId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [matches, setMatches] = useState<MatchRecommendation[]>([]);
  const [sessions, setSessions] = useState<SkillSwapSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [realtimeError, setRealtimeError] = useState("");

  const [skillName, setSkillName] = useState("");
  const [skillDirection, setSkillDirection] = useState<SkillDirection>("offered");
  const [skillCategory, setSkillCategory] = useState<SkillCategory>("Programming");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("Intermediate");
  const [availabilityDay, setAvailabilityDay] = useState(1);
  const [availabilityStart, setAvailabilityStart] = useState("18:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("20:00");

  const [proposalTarget, setProposalTarget] = useState<ProposalTarget | null>(null);
  const [proposalStart, setProposalStart] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [verificationSkillId, setVerificationSkillId] = useState("");
  const [verificationType, setVerificationType] = useState<"quiz" | "portfolio">("portfolio");
  const [verificationEvidence, setVerificationEvidence] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [disputeSessionId, setDisputeSessionId] = useState("");
  const [disputeKind, setDisputeKind] = useState<"no_show" | "dispute">("no_show");
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewRatings, setReviewRatings] = useState<Record<string, number>>({});
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const refreshWorkspace = useCallback(async (
    token: string,
    fallbackProfile: SkillSwapProfile,
    currentUserId: string,
  ) => {
    const [profileResult, matchesResult, sessionsResult, notificationsResult, verificationsResult] =
      await Promise.all([
        fetchSkillSwapApi<ProfileResponse>("/api/skillswap/profile", token),
        fetchSkillSwapApi<MatchesResponse>("/api/skillswap/matches", token),
        fetchSkillSwapApi<SessionsResponse>("/api/skillswap/sessions", token),
        fetchSkillSwapApi<NotificationsResponse>("/api/skillswap/notifications", token),
        fetchSkillSwapApi<VerificationsResponse>("/api/skillswap/verifications", token),
      ]);
    setProfile(profileResult.profile ?? fallbackProfile);
    setProfileSaved(Boolean(profileResult.profile));
    setMatches(matchesResult.matches);
    setSessions(sessionsResult.sessions);
    setNotifications(notificationsResult.notifications);
    setVerifications(verificationsResult.submissions.filter((item) => item.user_id === currentUserId));
    setReviewQueue(verificationsResult.submissions.filter(
      (item) => item.user_id !== currentUserId && item.status === "pending",
    ));
    setError("");
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let active = true;
    const initialize = async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("Conectează-te pentru a folosi SkillSwap.");
        const token = data.session.access_token;
        const nextUserId = data.session.user.id;
        const fallbackProfile = createEmptyProfile(
          getDefaultDisplayName(data.session.user),
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Bucharest",
        );
        if (!active) return;
        setAccessToken(token);
        setUserId(nextUserId);
        setProfile(fallbackProfile);
        await refreshWorkspace(token, fallbackProfile, nextUserId);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Nu am putut încărca SkillSwap.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId || !accessToken) return;

    const channel = client
      .channel(`skillswap:user:${userId}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "skillswap_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const item = payload.new as Partial<Notification>;
          if (
            typeof item.id !== "string" ||
            typeof item.message !== "string" ||
            typeof item.created_at !== "string"
          ) {
            setRealtimeError("A sosit o notificare cu format invalid.");
            return;
          }
          const notification: Notification = {
            id: item.id,
            session_id: typeof item.session_id === "string" ? item.session_id : null,
            type: typeof item.type === "string" ? item.type : "session_requested",
            message: item.message,
            read_at: typeof item.read_at === "string" ? item.read_at : null,
            created_at: item.created_at,
          };
          setNotifications((current) => [notification, ...current].slice(0, 30));
          setToast(notification.message);
          if (notification.session_id) {
            void fetchSkillSwapApi<SessionsResponse>(
              "/api/skillswap/sessions",
              accessToken,
            ).then(({ sessions: latestSessions }) => setSessions(latestSessions))
              .catch((requestError: unknown) => setError(
                requestError instanceof Error
                  ? requestError.message
                  : "Nu am putut actualiza sesiunile.",
              ));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeError("Notificările live nu sunt disponibile momentan.");
        } else if (status === "SUBSCRIBED") {
          setRealtimeError("");
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [accessToken, userId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const skillTree = useMemo(() => {
    const offered = profile?.skills.find((skill) => skill.direction === "offered")?.name ?? "";
    const wanted = profile?.skills.find((skill) => skill.direction === "wanted")?.name ?? "";
    return getSuggestedSkillPath(offered, wanted);
  }, [profile?.skills]);

  const matchingReady = Boolean(
    profile?.skills.some((skill) => skill.direction === "offered") &&
    profile.skills.some((skill) => skill.direction === "wanted") &&
    profile.availability.length > 0,
  );
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const directMatches = matches.filter((match): match is DirectMatch => match.kind === "direct");
  const cycleMatches = matches.filter((match): match is CycleMatch => match.kind === "cycle");
  const updateProfile = (updates: Partial<SkillSwapProfile>) => {
    setProfile((current) => current ? { ...current, ...updates } : current);
    setProfileSaved(false);
    setNotice("");
  };

  const addSkill = () => {
    if (!profile || !skillName.trim()) return;
    if (profile.skills.length >= 20) {
      setError("Poți adăuga cel mult 20 de abilități.");
      return;
    }
    const skillKey = skillName.trim().toLocaleLowerCase("en-US");
    if (profile.skills.some((skill) =>
      skill.direction === skillDirection && skill.skillKey === skillKey
    )) {
      setError("Această abilitate este deja în listă.");
      return;
    }
    const newSkill: SkillSwapSkill = {
      id: crypto.randomUUID(),
      direction: skillDirection,
      name: skillName.trim(),
      skillKey,
      category: skillCategory,
      level: skillLevel,
    };
    updateProfile({ skills: [...profile.skills, newSkill] });
    setSkillName("");
    setError("");
  };

  const removeSkill = (skill: SkillSwapSkill) => {
    if (!profile) return;
    updateProfile({
      skills: profile.skills.filter((item) =>
        item.id ? item.id !== skill.id : item !== skill
      ),
    });
  };

  const addAvailability = () => {
    if (!profile) return;
    const startMinute = parseTime(availabilityStart);
    const endMinute = parseTime(availabilityEnd);
    if (endMinute - startMinute < 60) {
      setError("Alege un interval de cel puțin 60 de minute.");
      return;
    }
    const slot: AvailabilitySlot = {
      weekday: availabilityDay,
      startMinute,
      endMinute,
    };
    if (profile.availability.some((item) =>
      item.weekday === slot.weekday &&
      item.startMinute === slot.startMinute &&
      item.endMinute === slot.endMinute
    )) {
      setError("Acest interval este deja în listă.");
      return;
    }
    if (profile.availability.length >= 21) {
      setError("Poți adăuga cel mult 21 de intervale.");
      return;
    }
    updateProfile({ availability: [...profile.availability, slot] });
    setError("");
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !accessToken) return;
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      await fetchSkillSwapApi("/api/skillswap/profile", accessToken, {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setNotice("Profilul SkillSwap a fost salvat.");
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut salva profilul.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const startProposal = (target: ProposalTarget) => {
    if (!profile) return;
    const firstSuggestion = target.kind === "direct"
      ? target.match.nextSlots[0]
      : undefined;
    const defaultDate = firstSuggestion
      ? new Date(firstSuggestion)
      : now
        ? new Date(now.getTime() + 24 * 60 * 60_000)
        : null;
    setProposalStart(defaultDate
      ? getLocalDateTimeInputValue(defaultDate, profile.timezone)
      : "");
    setProposalTarget(target);
    setError("");
  };

  const submitProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !accessToken || !proposalTarget) return;
    const startsAt = localDateTimeToIso(proposalStart, profile.timezone);
    if (!startsAt) {
      setError("Alege o dată și o oră valide.");
      return;
    }
    setProposalLoading(true);
    setError("");
    try {
      if (proposalTarget.kind === "direct") {
        await fetchSkillSwapApi("/api/skillswap/sessions", accessToken, {
          method: "POST",
          body: JSON.stringify({
            teacherId: proposalTarget.match.partner.userId,
            skill: proposalTarget.match.learnsSkill,
            startsAt,
          }),
        });
        setNotice("Propunerea de schimb a fost trimisă.");
      } else {
        await fetchSkillSwapApi("/api/skillswap/cycles", accessToken, {
          method: "POST",
          body: JSON.stringify({
            startsAt,
            legs: proposalTarget.match.legs.map(({ teacherId, learnerId, skill }) => ({
              teacherId,
              learnerId,
              skill,
            })),
          }),
        });
        setNotice("Propunerea de schimb în trei a fost trimisă.");
      }
      setProposalTarget(null);
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut trimite propunerea.",
      );
    } finally {
      setProposalLoading(false);
    }
  };

  const updateSession = async (
    sessionId: string,
    action: "accept" | "decline" | "cancel" | "confirm",
  ) => {
    if (!accessToken || !profile) return;
    setError("");
    try {
      await fetchSkillSwapApi(`/api/skillswap/sessions/${sessionId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setNotice(
        action === "accept"
          ? "Sesiunea a fost acceptată."
          : action === "confirm"
            ? "Confirmarea a fost înregistrată."
            : "Sesiunea a fost actualizată.",
      );
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut actualiza sesiunea.",
      );
    }
  };

  const submitDispute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !profile || !disputeSessionId) return;
    try {
      await fetchSkillSwapApi(`/api/skillswap/sessions/${disputeSessionId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ action: disputeKind, reason: disputeReason }),
      });
      setDisputeSessionId("");
      setDisputeReason("");
      setNotice("Sesizarea a fost trimisă către echipa de administrare.");
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut trimite sesizarea.",
      );
    }
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>, sessionId: string) => {
    event.preventDefault();
    if (!accessToken || !profile) return;
    try {
      await fetchSkillSwapApi(`/api/skillswap/sessions/${sessionId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          action: "review",
          rating: reviewRatings[sessionId] ?? 5,
          comment: reviewComments[sessionId] ?? "",
        }),
      });
      setNotice("Mulțumim pentru evaluare.");
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut salva evaluarea.",
      );
    }
  };

  const submitVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !profile || !verificationSkillId) return;
    try {
      await fetchSkillSwapApi("/api/skillswap/verifications", accessToken, {
        method: "POST",
        body: JSON.stringify({
          skillId: verificationSkillId,
          submissionType: verificationType,
          evidence: verificationEvidence,
        }),
      });
      setVerificationSkillId("");
      setVerificationEvidence("");
      setNotice("Dovada a fost trimisă pentru evaluare de către colegi.");
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut trimite dovada.",
      );
    }
  };

  const reviewVerification = async (verification: Verification, approved: boolean) => {
    if (!accessToken || !profile) return;
    try {
      await fetchSkillSwapApi("/api/skillswap/verifications/review", accessToken, {
        method: "POST",
        body: JSON.stringify({
          verificationId: verification.id,
          approved,
          note: reviewNotes[verification.id] ?? "",
        }),
      });
      setNotice("Evaluarea colegială a fost înregistrată.");
      await refreshWorkspace(accessToken, profile, userId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut înregistra evaluarea.",
      );
    }
  };

  const markNotificationRead = async (notification: Notification) => {
    if (!accessToken || notification.read_at) return;
    try {
      await fetchSkillSwapApi("/api/skillswap/notifications", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ notificationId: notification.id }),
      });
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      ));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut marca notificarea ca citită.",
      );
    }
  };

  const addTreeSkill = (name: string) => {
    if (!profile || !name.trim()) return;
    const skillKey = name.trim().toLocaleLowerCase("en-US");
    if (profile.skills.some((skill) =>
      skill.direction === "wanted" && skill.skillKey === skillKey
    )) return;
    updateProfile({
      skills: [
        ...profile.skills,
        {
          id: crypto.randomUUID(),
          direction: "wanted",
          name: name.trim(),
          skillKey,
          category: profile.skills[0]?.category ?? "Other",
          level: "Beginner",
        },
      ],
    });
    setNotice(`${name} a fost adăugată la abilitățile dorite. Salvează profilul.`);
  };

  const matchingCycleForSession = useMemo(() => {
    const cycles = new Map<string, SkillSwapSession[]>();
    for (const session of sessions) {
      if (!session.cycle_id) continue;
      const current = cycles.get(session.cycle_id) ?? [];
      current.push(session);
      cycles.set(session.cycle_id, current);
    }
    return cycles;
  }, [sessions]);

  if (!supabase) {
    return (
      <div className="section-page skillswap-page">
        <div className="skillswap-feedback error" role="alert">
          Supabase nu este configurat pentru SkillSwap.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-page skillswap-page">
        <div className="skillswap-loading card-surface" role="status">
          Se încarcă SkillSwap...
        </div>
      </div>
    );
  }

  return (
    <div className="section-page skillswap-page">
      <header className="page-heading skillswap-heading">
        <div>
          <p className="eyebrow">ÎNVAȚĂ ÎMPREUNĂ</p>
          <h1>SkillSwap</h1>
          <p className="muted">
            Schimbă ce știi cu ce vrei să înveți, alături de comunitatea UniFlow.
          </p>
        </div>
        <span className="skillswap-free-badge">Gratuit pentru toți</span>
      </header>

      <section className="skillswap-hero">
        <div>
          <span className="skillswap-hero-kicker">CUNOȘTINȚELE CRESC CÂND LE ÎMPĂRTĂȘEȘTI</span>
          <h2>Tu știi ceva. Cineva vrea să învețe.</h2>
          <p>Potriviri după abilități complementare, timp disponibil și evaluări.</p>
        </div>
        <div className="skillswap-hero-foot">
          <span>Fără plăți, solduri sau credite</span>
          <span>Sesiuni individuale de 60 de minute</span>
        </div>
      </section>

      {(error || notice || realtimeError) && (
        <div className={`skillswap-feedback${error ? " error" : ""}`} role={error ? "alert" : "status"}>
          <span>{error || notice || realtimeError}</span>
          {error && (
            <small>
              Dacă tabelele SkillSwap nu există încă, aplică migrarea
              <code>supabase/migrations/20261113223000_skillswap.sql</code> în Supabase.
            </small>
          )}
          {!error && <button aria-label="Închide mesajul" onClick={() => setNotice("")} type="button">×</button>}
        </div>
      )}

      {toast && (
        <div className="skillswap-toast" role="status">
          {toast}
        </div>
      )}

      <div className="skillswap-overview">
        <article className="skillswap-stat card-surface">
          <div><strong>{directMatches.length}</strong><small>potriviri directe</small></div>
        </article>
        <article className="skillswap-stat card-surface">
          <div><strong>{sessions.filter((session) =>
            ["requested", "accepted", "awaiting_confirmation"].includes(session.status)
          ).length}</strong><small>sesiuni active</small></div>
        </article>
        <article className="skillswap-stat card-surface">
          <div><strong>{profile?.verifiedSkills?.length ?? 0}</strong><small>abilități verificate</small></div>
        </article>
        <article className="skillswap-stat card-surface">
          <div><strong>{unreadCount}</strong><small>notificări noi</small></div>
        </article>
      </div>

      <div className="skillswap-layout">
        <div className="skillswap-main-column">
          <section className="card-surface skillswap-matches">
            <div className="skillswap-section-heading">
              <div>
                <p className="eyebrow">POTRIVIRI PENTRU TINE</p>
                <h2>Oameni de la care poți învăța</h2>
              </div>
              <span className="skillswap-match-count">{directMatches.length} directe</span>
            </div>

            {!matchingReady ? (
              <div className="skillswap-empty">
                <div>
                  <strong>Completează-ți profilul pentru potriviri</strong>
                  <p>Adaugă o abilitate pe care o oferi, una pe care o cauți și un interval disponibil.</p>
                </div>
              </div>
            ) : directMatches.length === 0 && cycleMatches.length === 0 ? (
              <div className="skillswap-empty">
                <div>
                  <strong>Nu există încă potriviri</strong>
                  <p>Revino după ce alți colegi adaugă abilități complementare.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="skillswap-match-list">
                  {directMatches.map((match) => (
                    <article className="skillswap-match-card" key={match.partner.userId}>
                      <div className="skillswap-match-avatar">
                        {match.partner.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="skillswap-match-details">
                        <div className="skillswap-match-title">
                          <strong>{match.partner.displayName}</strong>
                        </div>
                        <p>{match.partner.bio || "Membru UniFlow, gata să împărtășească ce știe."}</p>
                        <div className="skillswap-match-skills">
                          <span className="skill-tag learn">Înveți {match.learnsSkill}</span>
                          <span className="skill-tag teach">Oferi {match.teachesSkill}</span>
                          {match.partner.verifiedSkills.includes(
                            match.learnsSkill.toLocaleLowerCase("en-US"),
                          ) && <span className="skill-verified">Verificat</span>}
                        </div>
                        <div className="skillswap-match-meta">
                          <span>{match.partner.ratingCount
                            ? `${match.partner.rating.toFixed(1)} (${match.partner.ratingCount})`
                            : "Fără evaluări"}</span>
                          <span>{match.nextSlots.length
                            ? `${match.nextSlots.length} intervale comune`
                            : "Actualizați disponibilitatea"}</span>
                        </div>
                        {match.nextSlots.length > 0 && (
                          <div className="skillswap-next-slots">
                            {match.nextSlots.slice(0, 2).map((slot) => (
                              <span key={slot}>{formatSkillSwapTime(slot, profile?.timezone ?? "UTC")}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="button button-primary skillswap-propose-button"
                        disabled={!match.nextSlots.length || !profile}
                        onClick={() => startProposal({ kind: "direct", match })}
                        type="button"
                      >
                        Propune schimb
                      </button>
                    </article>
                  ))}
                </div>

                {cycleMatches.length > 0 && (
                  <div className="skillswap-cycles">
                    <div className="skillswap-subheading">
                      <div>
                        <strong>Schimburi circulare</strong>
                        <small>O potrivire în trei, când nu există o cale directă.</small>
                      </div>
                    </div>
                    {cycleMatches.slice(0, 3).map((cycle, index) => (
                      <article className="skillswap-cycle-card" key={`${cycle.members.map((member) => member.userId).join("-")}-${index}`}>
                        <div className="skillswap-cycle-header">
                          <strong>{cycle.members.map((member) =>
                            member.userId === userId ? "Tu" : member.displayName
                          ).join(" → ")}</strong>
                        </div>
                        <ol>
                          {cycle.legs.map((leg) => (
                            <li key={`${leg.teacherId}-${leg.learnerId}-${leg.skill}`}>
                              <span>{leg.teacherId === userId ? "Tu" : leg.teacherName}</span>
                              <span aria-hidden="true">→</span>
                              <span>{leg.learnerId === userId ? "tu" : leg.learnerName}</span>
                              <small>{leg.skill}</small>
                            </li>
                          ))}
                        </ol>
                        <button
                          className="button button-secondary"
                          onClick={() => startProposal({ kind: "cycle", match: cycle })}
                          type="button"
                        >
                          Propune schimbul în trei
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card-surface skillswap-tree-card">
            <div className="skillswap-section-heading">
              <div>
                <p className="eyebrow">URMĂTORUL TĂU PAS</p>
                <h2>Arborele abilităților</h2>
              </div>
              <span className="skillswap-tree-domain">{skillTree.domain}</span>
            </div>
            <p className="skillswap-tree-copy">Construiește un parcurs între ceea ce știi și ceea ce vrei să înveți.</p>
            <div className="skillswap-tree" aria-label={`Parcurs de învățare: ${skillTree.nodes.join(", ")}`}>
              {skillTree.nodes.map((node, index) => {
                const normalizedNode = node.toLocaleLowerCase("en-US");
                const isKnown = profile?.skills.some((skill) =>
                  skill.direction === "offered" && skill.skillKey === normalizedNode
                );
                const isWanted = profile?.skills.some((skill) =>
                  skill.direction === "wanted" && skill.skillKey === normalizedNode
                );
                return (
                  <div className="skillswap-tree-step" key={`${node}-${index}`}>
                    <button
                      className={`skillswap-tree-node${isKnown ? " known" : ""}${isWanted ? " wanted" : ""}`}
                      onClick={() => addTreeSkill(node)}
                      title={isWanted ? "Deja în lista de învățat" : "Adaugă la abilitățile dorite"}
                      type="button"
                    >
                      <span>{index + 1}</span>{node}
                    </button>
                    {index < skillTree.nodes.length - 1 && (
                      <span className="skillswap-tree-edge" aria-hidden="true">→</span>
                    )}
                  </div>
                );
              })}
            </div>
            <small className="skillswap-tree-hint">Apasă pe un nod pentru a-l adăuga la abilitățile dorite.</small>
          </section>

          {reviewQueue.length > 0 && (
            <section className="card-surface skillswap-review-queue">
              <div className="skillswap-section-heading">
                <div>
                  <p className="eyebrow">COMUNITATEA TE AJUTĂ</p>
                  <h2>Evaluări între colegi</h2>
                </div>
                <span className="skillswap-match-count">{reviewQueue.length} de trimis</span>
              </div>
              {reviewQueue.map((item) => (
                <article className="skillswap-verification-card" key={item.id}>
                  <div>
                    <strong>{item.displayName} · {item.skillName}</strong>
                    <span className="verification-type">{item.submission_type === "quiz" ? "Răspuns la quiz" : "Mini-portofoliu"}</span>
                    <p>{item.evidence}</p>
                  </div>
                  <label className="skillswap-inline-field">
                    <span>Notă pentru coleg (opțional)</span>
                    <input
                      maxLength={400}
                      onChange={(event) => setReviewNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))}
                      value={reviewNotes[item.id] ?? ""}
                    />
                  </label>
                  <div className="skillswap-review-actions">
                    <button className="button button-secondary" onClick={() => void reviewVerification(item, false)} type="button">Cere revizuire</button>
                    <button className="button button-primary" onClick={() => void reviewVerification(item, true)} type="button">Verifică abilitatea</button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>

        <aside className="skillswap-side-column">
          <section className="card-surface skillswap-profile-card">
            <div className="skillswap-section-heading">
              <div>
                <p className="eyebrow">PROFILUL TĂU</p>
                <h2>Setează schimbul</h2>
              </div>
              {profileSaved && <span className="skillswap-saved">Salvat</span>}
            </div>
            <form onSubmit={saveProfile}>
              <label className="form-field">
                <span>Numele afișat</span>
                <input
                  maxLength={80}
                  onChange={(event) => updateProfile({ displayName: event.target.value })}
                  required
                  value={profile?.displayName ?? ""}
                />
              </label>
              <label className="form-field">
                <span>Despre tine</span>
                <textarea
                  maxLength={400}
                  onChange={(event) => updateProfile({ bio: event.target.value })}
                  placeholder="Ce îți place să înveți sau să predai?"
                  rows={3}
                  value={profile?.bio ?? ""}
                />
              </label>
              <label className="form-field">
                <span>Fus orar IANA</span>
                <input
                  maxLength={64}
                  onChange={(event) => updateProfile({ timezone: event.target.value })}
                  placeholder="Europe/Bucharest"
                  required
                  value={profile?.timezone ?? ""}
                />
              </label>

              <div className="skillswap-form-divider" />
              <div className="skillswap-subheading">
                <div><strong>Abilități</strong><small>Ce poți preda și ce vrei să înveți.</small></div>
              </div>
              <div className="skillswap-skill-list">
                {profile?.skills.map((skill, index) => {
                  const verified = profile.verifiedSkills?.includes(skill.skillKey) ?? false;
                  const submission = verifications.find((item) =>
                    item.skill_id === skill.id && item.status === "pending"
                  );
                  return (
                    <div className="skillswap-skill-row" key={skill.id || `${skill.skillKey}-${index}`}>
                      <div>
                        <strong>{skill.name}</strong>
                        <small>{skill.direction === "offered" ? "Oferi" : "Cauți"} · {skill.category} · {skill.level}</small>
                      </div>
                      {verified && <span className="verified-mini" title="Abilitate verificată">Verificat</span>}
                      {skill.direction === "offered" && !verified && (
                        <button
                          className="skillswap-verify-button"
                          disabled={!profileSaved || Boolean(submission)}
                          onClick={() => setVerificationSkillId(skill.id)}
                          type="button"
                        >
                          {submission ? "În evaluare" : profileSaved ? "Verifică" : "Salvează profilul"}
                        </button>
                      )}
                      <button
                        aria-label={`Șterge abilitatea ${skill.name}`}
                        className="skillswap-remove"
                        onClick={() => removeSkill(skill)}
                        type="button"
                      >×</button>
                    </div>
                  );
                })}
                {!profile?.skills.length && <p className="skillswap-subtle">Adaugă prima abilitate ca să pornești.</p>}
              </div>
              <div className="skillswap-skill-add">
                <label className="form-field">
                  <span>Abilitate</span>
                  <input
                    maxLength={60}
                    onChange={(event) => setSkillName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Ex. Figma, engleză, Python"
                    value={skillName}
                  />
                </label>
                <div className="skillswap-mini-grid">
                  <label className="form-field">
                    <span>Direcție</span>
                    <select onChange={(event) => setSkillDirection(event.target.value as SkillDirection)} value={skillDirection}>
                      <option value="offered">Pot preda</option>
                      <option value="wanted">Vreau să învăț</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Domeniu</span>
                    <select onChange={(event) => setSkillCategory(event.target.value as SkillCategory)} value={skillCategory}>
                      {skillCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="form-field skillswap-level-field">
                    <span>Nivel</span>
                    <select onChange={(event) => setSkillLevel(event.target.value as SkillLevel)} value={skillLevel}>
                      {skillLevels.map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </label>
                </div>
                <button className="button button-secondary skillswap-add-button" disabled={!skillName.trim()} onClick={addSkill} type="button">
                  Adaugă abilitate
                </button>
              </div>

              <div className="skillswap-form-divider" />
              <div className="skillswap-subheading">
                <span className="skillswap-subheading-icon mint"><Icon name="calendar" size={15} /></span>
                <div><strong>Disponibilitate</strong><small>Intervale recurente, în fusul tău orar.</small></div>
              </div>
              <div className="skillswap-availability-list">
                {profile?.availability.map((slot, index) => (
                  <div className="skillswap-availability-row" key={`${slot.weekday}-${slot.startMinute}-${slot.endMinute}-${index}`}>
                    <span>{weekdays[slot.weekday]}</span>
                    <strong>{formatAvailabilityTime(slot.startMinute)}–{formatAvailabilityTime(slot.endMinute)}</strong>
                    <button
                      aria-label={`Șterge intervalul ${weekdays[slot.weekday]}`}
                      className="skillswap-remove"
                      onClick={() => updateProfile({
                        availability: profile.availability.filter((_, slotIndex) => slotIndex !== index),
                      })}
                      type="button"
                    >×</button>
                  </div>
                ))}
                {!profile?.availability.length && <p className="skillswap-subtle">Adaugă un interval săptămânal de cel puțin o oră.</p>}
              </div>
              <div className="skillswap-availability-add">
                <label className="form-field">
                  <span>Zi</span>
                  <select onChange={(event) => setAvailabilityDay(Number(event.target.value))} value={availabilityDay}>
                    {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>De la</span>
                  <input onChange={(event) => setAvailabilityStart(event.target.value)} type="time" value={availabilityStart} />
                </label>
                <label className="form-field">
                  <span>Până la</span>
                  <input onChange={(event) => setAvailabilityEnd(event.target.value)} type="time" value={availabilityEnd} />
                </label>
                <button className="button button-secondary" onClick={addAvailability} type="button">
                  Interval
                </button>
              </div>
              <p className="skillswap-timezone-note">
                Orele sunt interpretate în <strong>{profile?.timezone}</strong>.
              </p>

              <button className="button button-primary skillswap-save-profile" disabled={savingProfile} type="submit">
                {savingProfile ? "Se salvează..." : "Salvează profilul"}
              </button>
            </form>

            {verificationSkillId && (
              <form className="skillswap-verification-form" onSubmit={submitVerification}>
                <div className="skillswap-subheading">
                  <div><strong>Verifică această abilitate</strong><small>Un coleg care oferă aceeași abilitate va evalua dovada.</small></div>
                </div>
                <label className="form-field">
                  <span>Tip de verificare</span>
                  <select onChange={(event) => setVerificationType(event.target.value as "quiz" | "portfolio")} value={verificationType}>
                    <option value="portfolio">Mini-portofoliu</option>
                    <option value="quiz">Răspuns la quiz</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>{verificationType === "quiz" ? "Răspuns / explicație" : "Link sau descriere de proiect"}</span>
                  <textarea
                    maxLength={1200}
                    minLength={10}
                    onChange={(event) => setVerificationEvidence(event.target.value)}
                    required
                    rows={3}
                    value={verificationEvidence}
                  />
                </label>
                <div className="skillswap-review-actions">
                  <button className="button button-secondary" onClick={() => setVerificationSkillId("")} type="button">Anulează</button>
                  <button className="button button-primary" type="submit">Trimite pentru evaluare</button>
                </div>
              </form>
            )}
          </section>

          <section className="card-surface skillswap-session-card">
            <div className="skillswap-section-heading">
              <div>
                <p className="eyebrow">PLANUL TĂU DE ÎNVĂȚARE</p>
                <h2>Sesiuni</h2>
              </div>
              <span className="skillswap-match-count">{sessions.length}</span>
            </div>
            {sessions.length === 0 ? (
              <div className="skillswap-sessions-empty">
                <span>Propune un schimb și sesiunile tale vor apărea aici.</span>
              </div>
            ) : (
              <div className="skillswap-session-list">
                {sessions.slice(0, 8).map((session) => {
                  const isTeacher = session.teacher_id === userId;
                  const partnerName = isTeacher ? session.learner_name : session.teacher_name;
                  const cycleCount = session.cycle_id
                    ? matchingCycleForSession.get(session.cycle_id)?.length ?? 3
                    : 1;
                  return (
                    <article className="skillswap-session" key={session.id}>
                      <div className="skillswap-session-marker" />
                      <div className="skillswap-session-content">
                        <div className="skillswap-session-top">
                          <strong>{session.skill}</strong>
                          <span className={`session-status ${session.status}${session.status === "awaiting_confirmation" ? " cancelled" : ""}`}>
                            {sessionStatusLabels[session.status]}
                          </span>
                        </div>
                        <p>{isTeacher ? "Predai" : "Înveți"} cu {partnerName}</p>
                        <small>{formatSkillSwapTime(session.starts_at, profile?.timezone ?? "UTC")} · 60 min · Gratuit</small>
                        {session.cycle_id && <small className="cycle-session-note">Parte dintr-un schimb în {cycleCount} pași.</small>}
                        <div className="skillswap-session-actions">
                          {session.status === "requested" && isTeacher && (
                            <>
                              <button className="button button-primary" onClick={() => void updateSession(session.id, "accept")} type="button">Acceptă</button>
                              <button className="button button-secondary" onClick={() => void updateSession(session.id, "decline")} type="button">Refuză</button>
                            </>
                          )}
                          {session.status === "requested" && !isTeacher && (
                            <button className="button button-secondary" onClick={() => void updateSession(session.id, "cancel")} type="button">Retrage propunerea</button>
                          )}
                          {session.status === "accepted" && (
                            <>
                              <Link className="button button-primary" href={`/skillswap/room/${session.id}`}>
                                Intră în sala live
                              </Link>
                              <button className="button button-secondary" onClick={() => {
                                setDisputeSessionId(session.id);
                                setDisputeKind("no_show");
                              }} type="button">Raportează</button>
                            </>
                          )}
                          {session.status === "awaiting_confirmation" && (
                            <>
                              <Link className="button button-secondary" href={`/skillswap/room/${session.id}`}>
                                Sala live
                              </Link>
                              <button className="button button-primary" onClick={() => void updateSession(session.id, "confirm")} type="button">
                                Confirmă încheierea
                              </button>
                              <button className="button button-secondary" onClick={() => {
                                setDisputeSessionId(session.id);
                                setDisputeKind("dispute");
                              }} type="button">Deschide sesizare</button>
                            </>
                          )}
                          {session.status === "completed" && !session.reviewed_by_me && (
                            <form className="skillswap-review-form" onSubmit={(event) => void submitReview(event, session.id)}>
                              <label className="form-field">
                                <span>Evaluare</span>
                                <select
                                  onChange={(event) => setReviewRatings((current) => ({
                                    ...current,
                                    [session.id]: Number(event.target.value),
                                  }))}
                                  value={reviewRatings[session.id] ?? 5}
                                >
                                  <option value={5}>★★★★★ · 5</option>
                                  <option value={4}>★★★★☆ · 4</option>
                                  <option value={3}>★★★☆☆ · 3</option>
                                  <option value={2}>★★☆☆☆ · 2</option>
                                  <option value={1}>★☆☆☆☆ · 1</option>
                                </select>
                              </label>
                              <label className="form-field">
                                <span>Comentariu (opțional)</span>
                                <input
                                  maxLength={400}
                                  onChange={(event) => setReviewComments((current) => ({
                                    ...current,
                                    [session.id]: event.target.value,
                                  }))}
                                  value={reviewComments[session.id] ?? ""}
                                />
                              </label>
                              <button className="button button-secondary" type="submit">Trimite evaluarea</button>
                            </form>
                          )}
                        </div>
                        {disputeSessionId === session.id && (
                          <form className="skillswap-dispute-form" onSubmit={submitDispute}>
                            <label className="form-field">
                              <span>Tipul sesizării</span>
                              <select onChange={(event) => setDisputeKind(event.target.value as "no_show" | "dispute")} value={disputeKind}>
                                <option value="no_show">Partenerul nu a participat</option>
                                <option value="dispute">Altă problemă</option>
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Descrie situația</span>
                              <textarea
                                maxLength={1200}
                                minLength={10}
                                onChange={(event) => setDisputeReason(event.target.value)}
                                required
                                rows={3}
                                value={disputeReason}
                              />
                            </label>
                            <div className="skillswap-review-actions">
                              <button className="button button-secondary" onClick={() => setDisputeSessionId("")} type="button">Anulează</button>
                              <button className="button button-danger" type="submit">Trimite sesizarea</button>
                            </div>
                          </form>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card-surface skillswap-notifications-card">
            <div className="skillswap-section-heading">
              <div>
                <p className="eyebrow">ACTUALIZĂRI LIVE</p>
                <h2>Notificări</h2>
              </div>
              {unreadCount > 0 && <span className="skillswap-unread-count">{unreadCount}</span>}
            </div>
            {notifications.length === 0 ? (
              <p className="skillswap-subtle">Notificările despre propuneri și sesiuni vor apărea aici.</p>
            ) : (
              <div className="skillswap-notification-list">
                {notifications.slice(0, 5).map((notification) => (
                  <div
                    className={`skillswap-notification${notification.read_at ? "" : " unread"}`}
                    key={notification.id}
                  >
                    <button
                      className="skillswap-notification-copy"
                      disabled={Boolean(notification.read_at)}
                      onClick={() => void markNotificationRead(notification)}
                      type="button"
                    >
                      <span className="notification-dot" />
                      <span><strong>{notification.message}</strong><small>{formatSkillSwapTime(notification.created_at, profile?.timezone ?? "UTC")}</small></span>
                    </button>
                    {notification.session_id && <Link href={`/skillswap/room/${notification.session_id}`}>Deschide</Link>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {proposalTarget && (
        <div className="skillswap-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProposalTarget(null);
        }}>
          <form className="skillswap-modal card-surface" onSubmit={submitProposal}>
            <button aria-label="Închide fereastra" className="skillswap-modal-close" onClick={() => setProposalTarget(null)} type="button">×</button>
            <p className="eyebrow">PROPUNE UN SCHIMB GRATUIT</p>
            <h2>{proposalTarget.kind === "direct" ? "Alege o oră pentru sesiune" : "Planifică schimbul în trei"}</h2>
            <p className="muted">overflow: hidden
              {proposalTarget.kind === "direct"
                ? `O sesiune de 60 de minute cu ${proposalTarget.match.partner.displayName}, pentru ${proposalTarget.match.learnsSkill}.`
                : "Sunt programate trei sesiuni consecutive de câte 60 de minute. Fiecare participant trebuie să confirme schimbul."}
            </p>
            {proposalTarget.kind === "direct" && proposalTarget.match.nextSlots.length > 0 && (
              <div className="skillswap-modal-slots">
                <strong>Intervale comune sugerate</strong>
                {proposalTarget.match.nextSlots.map((slot) => (
                  <button key={slot} onClick={() => setProposalStart(getLocalDateTimeInputValue(new Date(slot), profile?.timezone ?? "UTC"))} type="button">
                    {formatSkillSwapTime(slot, profile?.timezone ?? "UTC")}
                  </button>
                ))}
              </div>
            )}
            <label className="form-field">
              <span>Începe la ({profile?.timezone})</span>
              <input
                min={now
                  ? getLocalDateTimeInputValue(
                      new Date(now.getTime() + 15 * 60_000),
                      profile?.timezone ?? "UTC",
                    )
                  : undefined}
                onChange={(event) => setProposalStart(event.target.value)}
                required
                type="datetime-local"
                value={proposalStart}
              />
            </label>
            {proposalTarget.kind === "cycle" && (
              <ol className="skillswap-cycle-modal-list">
                {proposalTarget.match.legs.map((leg, index) => (
                  <li key={`${leg.teacherId}-${leg.learnerId}-${leg.skill}`}>
                    <span>{index + 1}</span>
                    {leg.teacherName} → {leg.learnerName}
                    <strong>{leg.skill}</strong>
                  </li>
                ))}
              </ol>
            )}
            <div className="skillswap-modal-footer">
              <button className="button button-secondary" onClick={() => setProposalTarget(null)} type="button">Anulează</button>
              <button className="button button-primary" disabled={proposalLoading} type="submit">
                {proposalLoading ? "Se trimite..." : "Trimite propunerea"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
