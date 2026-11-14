"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { fetchSkillSwapApi } from "@/lib/skillswap/client";
import type { SkillSwapSession } from "@/lib/skillswap/types";
import { supabase } from "@/lib/supabase";

type RoomSession = SkillSwapSession & {
  teacher_name: string;
  learner_name: string;
};

type SessionResponse = {
  session: RoomSession;
  currentUserId: string;
};

type IceConfigResponse = {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
};

type RoomPresence = {
  userId: string;
  mediaReady: boolean;
};

type SignalMessage = {
  from: string;
  type: "offer" | "answer" | "candidate";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type ChatMessage = {
  id: string;
  from: string;
  name: string;
  text: string;
  sentAt: string;
};

type LineSegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSignalMessage(value: unknown): SignalMessage | null {
  if (!isRecord(value) || typeof value.from !== "string") return null;
  if (value.type !== "offer" && value.type !== "answer" && value.type !== "candidate") {
    return null;
  }
  if (value.type === "candidate" && isRecord(value.candidate)) {
    return {
      from: value.from,
      type: "candidate",
      candidate: value.candidate as RTCIceCandidateInit,
    };
  }
  if (
    (value.type === "offer" || value.type === "answer") &&
    isRecord(value.description) &&
    (value.description.type === "offer" || value.description.type === "answer") &&
    typeof value.description.sdp === "string"
  ) {
    return {
      from: value.from,
      type: value.type,
      description: {
        type: value.description.type,
        sdp: value.description.sdp,
      },
    };
  }
  return null;
}

function getLineSegment(value: unknown): LineSegment | null {
  if (!isRecord(value) || !isRecord(value.from) || !isRecord(value.to)) return null;
  const { from, to } = value;
  if (
    typeof from.x !== "number" ||
    typeof from.y !== "number" ||
    typeof to.x !== "number" ||
    typeof to.y !== "number" ||
    typeof value.color !== "string" ||
    [from.x, from.y, to.x, to.y].some((coordinate) => coordinate < 0 || coordinate > 1)
  ) {
    return null;
  }
  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    color: value.color,
  };
}

export default function SkillSwapRoom({ sessionId }: { sessionId: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [userId, setUserId] = useState("");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaStarting, setMediaStarting] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [turnConfigured, setTurnConfigured] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [code, setCode] = useState("");
  const [roomError, setRoomError] = useState("");
  const [pythonStatus, setPythonStatus] = useState<"idle" | "loading" | "running">("idle");
  const [pythonOutput, setPythonOutput] = useState<{ stream: "stdout" | "stderr"; text: string }[]>([]);
  const pythonWorkerRef = useRef<Worker | null>(null);
  const pythonTimeoutRef = useRef<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [activePanel, setActivePanel] = useState<"board" | "code" | "chat">("board");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerSentRef = useRef(false);
  const finishRequestedRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);
  const drawLineRef = useRef<(segment: LineSegment) => void>(() => {});
  const codeBroadcastTimeoutRef = useRef<number | null>(null);
  const peerId = session
    ? userId === session.teacher_id
      ? session.learner_id
      : session.teacher_id
    : "";
  const myName = session
    ? userId === session.teacher_id
      ? session.teacher_name
      : session.learner_name
    : "Tu";
  const peerName = session
    ? userId === session.teacher_id
      ? session.learner_name
      : session.teacher_name
    : "Partenerul";

  const sessionTiming = useMemo(() => {
    if (!session) return null;
    const startsAt = new Date(session.starts_at).getTime();
    const endsAt = startsAt + session.duration_minutes * 60_000;
    return {
      startsAt,
      endsAt,
      secondsUntilStart: now === null ? null : Math.max(0, Math.ceil((startsAt - now) / 1000)),
      secondsRemaining: now === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000)),
    };
  }, [now, session]);

  const sendRoomEvent = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel) throw new Error("Conexiunea live nu este pregătită încă.");
    const status = await channel.send({
      type: "broadcast",
      event,
      payload: { ...payload, from: userId },
    });
    if (status !== "ok") {
      throw new Error("Mesajul live nu a putut fi trimis. Verifică conexiunea.");
    }
  }, [userId]);

  const stopRoomMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const applySessionUpdate = useCallback((updatedSession: SkillSwapSession) => {
    setSession((current) => current ? { ...current, ...updatedSession } : current);
  }, []);

  const finishSession = useCallback(async () => {
    if (!accessToken) return;
    finishRequestedRef.current = true;
    try {
      const { session: updatedSession } = await fetchSkillSwapApi<{ session: SkillSwapSession }>(
        `/api/skillswap/sessions/${sessionId}`,
        accessToken,
        { method: "PATCH", body: JSON.stringify({ action: "finish" }) },
      );
      applySessionUpdate(updatedSession);
      setRoomError("");
    } catch (error) {
      finishRequestedRef.current = false;
      setRoomError(error instanceof Error ? error.message : "Nu am putut încheia sesiunea.");
    }
  }, [accessToken, applySessionUpdate, sessionId]);

  const drawLine = useCallback((segment: LineSegment) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.strokeStyle = segment.color;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(segment.from.x * canvas.width, segment.from.y * canvas.height);
    context.lineTo(segment.to.x * canvas.width, segment.to.y * canvas.height);
    context.stroke();
  }, []);
  useEffect(() => {
    drawLineRef.current = drawLine;
  }, [drawLine]);

  const loadSession = useCallback(async () => {
    if (!supabase) throw new Error("Supabase nu este configurat pentru SkillSwap.");
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;
    const token = authData.session?.access_token;
    if (!token) throw new Error("Autentifică-te pentru a intra în sala SkillSwap.");

    const result = await fetchSkillSwapApi<SessionResponse>(
      `/api/skillswap/sessions/${sessionId}`,
      token,
    );
    setAccessToken(token);
    setUserId(result.currentUserId);
    setSession(result.session);
    setRoomError("");
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await loadSession();
      } catch (error) {
        if (active) {
          setRoomError(error instanceof Error ? error.message : "Nu am putut încărca sesiunea.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loadSession]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!session || !accessToken || session.status !== "accepted" ||
      sessionTiming?.secondsRemaining !== 0 || finishRequestedRef.current) {
      return;
    }
    void finishSession();
  }, [accessToken, finishSession, session, sessionTiming?.secondsRemaining]);

  useEffect(() => {
    const client = supabase;
    if (
      !client ||
      !session ||
      !userId ||
      !peerId ||
      !["accepted", "awaiting_confirmation"].includes(session.status)
    ) {
      return;
    }

    let active = true;
    const channel = client.channel(`skillswap:session:${sessionId}`, {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: userId },
        private: true,
      },
    });
    channelRef.current = channel;

    const maybeCreateOffer = async () => {
      const peerConnection = peerRef.current;
      const localMedia = localStreamRef.current;
      if (
        userId > peerId ||
        !peerConnection ||
        !localMedia ||
        offerSentRef.current
      ) {
        return;
      }
      const presence = channel.presenceState<RoomPresence>();
      const peerIsReady = Object.values(presence)
        .flat()
        .some((participant) => participant.userId === peerId && participant.mediaReady);
      if (!peerIsReady) return;

      offerSentRef.current = true;
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        const sendStatus = await channel.send({
          type: "broadcast",
          event: "rtc",
          payload: { from: userId, type: "offer", description: offer },
        });
        if (sendStatus !== "ok") throw new Error("Oferta video nu a putut fi trimisă.");
      } catch (error) {
        offerSentRef.current = false;
        if (active) setRoomError(
          error instanceof Error ? error.message : "Nu am putut iniția apelul video.",
        );
      }
    };

    const drainCandidates = async (peerConnection: RTCPeerConnection) => {
      const pending = queuedCandidatesRef.current.splice(0);
      for (const candidate of pending) {
        await peerConnection.addIceCandidate(candidate);
      }
    };

    channel
      .on("presence", { event: "sync" }, () => {
        void maybeCreateOffer();
      })
      .on("broadcast", { event: "rtc" }, ({ payload }) => {
        const message = getSignalMessage(payload);
        const peerConnection = peerRef.current;
        if (!message || message.from !== peerId || !peerConnection) return;

        void (async () => {
          try {
            if (message.type === "candidate" && message.candidate) {
              if (peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(message.candidate);
              } else {
                queuedCandidatesRef.current.push(message.candidate);
              }
              return;
            }
            if (!message.description) return;
            await peerConnection.setRemoteDescription(message.description);
            await drainCandidates(peerConnection);
            if (message.type === "offer") {
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              const status = await channel.send({
                type: "broadcast",
                event: "rtc",
                payload: { from: userId, type: "answer", description: answer },
              });
              if (status !== "ok") throw new Error("Răspunsul video nu a putut fi trimis.");
            }
          } catch (error) {
            if (active) setRoomError(
              error instanceof Error ? error.message : "Conexiunea video a eșuat.",
            );
          }
        })();
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        if (!isRecord(payload)) return;
        const { from, name, text, sentAt } = payload;
        if (
          from !== peerId ||
          typeof name !== "string" ||
          typeof text !== "string" ||
          text.length > 1000 ||
          typeof sentAt !== "string"
        ) {
          return;
        }
        setMessages((current) => [...current, {
          id: `${from}-${sentAt}`,
          from: peerId,
          name,
          text,
          sentAt,
        }]);
      })
      .on("broadcast", { event: "code" }, ({ payload }) => {
        if (
          isRecord(payload) &&
          payload.from === peerId &&
          typeof payload.text === "string" &&
          payload.text.length <= 20_000
        ) {
          setCode(payload.text);
        }
      })
      .on("broadcast", { event: "board" }, ({ payload }) => {
        if (isRecord(payload) && payload.from === peerId) {
          if (payload.action === "clear") {
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
            return;
          }
          const segment = getLineSegment(payload.segment);
          if (segment) drawLineRef.current(segment);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "skillswap_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isRecord(payload.new) || payload.new.session_id !== sessionId) return;
          void fetchSkillSwapApi<SessionResponse>(
            `/api/skillswap/sessions/${sessionId}`,
            accessToken,
          ).then(({ session: updatedSession }) => {
            setSession(updatedSession);
            if (updatedSession.status === "completed") stopRoomMedia();
          }).catch((error: unknown) => setRoomError(
            error instanceof Error ? error.message : "Nu am putut actualiza sesiunea.",
          ));
        },
      )
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        try {
          await channel.track({ userId, mediaReady: false });
          setRealtimeReady(true);
        } catch (error) {
          setRoomError(error instanceof Error ? error.message : "Nu am putut conecta sala live.");
        }
      });

    return () => {
      active = false;
      setRealtimeReady(false);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [accessToken, applySessionUpdate, peerId, session, sessionId, stopRoomMedia, userId]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => () => {
    if (codeBroadcastTimeoutRef.current !== null) {
      window.clearTimeout(codeBroadcastTimeoutRef.current);
    }
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startMedia = async () => {
    if (!supabase || !session || !realtimeReady || localStreamRef.current || mediaStarting) return;
    setMediaStarting(true);
    setRoomError("");
    try {
      const iceConfig = await fetchSkillSwapApi<IceConfigResponse>(
        "/api/skillswap/ice-config",
        accessToken,
      );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      const peerConnection = new RTCPeerConnection({ iceServers: iceConfig.iceServers });
      peerRef.current = peerConnection;
      setLocalStream(stream);
      setTurnConfigured(iceConfig.turnConfigured);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      peerConnection.ontrack = (event) => {
        const [incoming] = event.streams;
        if (incoming) setRemoteStream(incoming);
      };
      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) return;
        void sendRoomEvent("rtc", {
          type: "candidate",
          candidate: event.candidate.toJSON(),
        }).catch((error: unknown) => setRoomError(
          error instanceof Error ? error.message : "Nu am putut trimite datele video.",
        ));
      };
      await channelRef.current?.track({ userId, mediaReady: true });
    } catch (error) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      setLocalStream(null);
      setRoomError(
        error instanceof Error
          ? error.message
          : "Nu am putut porni camera și microfonul. Verifică permisiunile browserului.",
      );
    } finally {
      setMediaStarting(false);
    }
  };

  const leaveMedia = () => {
    stopRoomMedia();
    setCameraEnabled(true);
    setMicrophoneEnabled(true);
    offerSentRef.current = false;
    queuedCandidatesRef.current = [];
    void channelRef.current?.track({ userId, mediaReady: false });
  };

  const toggleMicrophone = () => {
    const nextEnabled = !microphoneEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setMicrophoneEnabled(nextEnabled);
  };

  const toggleCamera = () => {
    const nextEnabled = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setCameraEnabled(nextEnabled);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    drawingRef.current = true;
    lastPointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    const segment = { from: lastPointRef.current, to: point, color: "#7364d7" };
    drawLine(segment);
    lastPointRef.current = point;
    void sendRoomEvent("board", { segment }).catch((error: unknown) => setRoomError(
      error instanceof Error ? error.message : "Nu am putut sincroniza tabla.",
    ));
  };

  const handleCodeChange = (value: string) => {
    const nextCode = value.slice(0, 20_000);
    setCode(nextCode);
    if (codeBroadcastTimeoutRef.current !== null) {
      window.clearTimeout(codeBroadcastTimeoutRef.current);
    }
    codeBroadcastTimeoutRef.current = window.setTimeout(() => {
      void sendRoomEvent("code", { text: nextCode }).catch((error: unknown) => setRoomError(
        error instanceof Error ? error.message : "Nu am putut sincroniza codul.",
      ));
    }, 180);
  };

  const stopPython = useCallback(() => {
    if (pythonTimeoutRef.current !== null) {
      window.clearTimeout(pythonTimeoutRef.current);
      pythonTimeoutRef.current = null;
    }
    pythonWorkerRef.current?.terminate();
    pythonWorkerRef.current = null;
    setPythonStatus("idle");
  }, []);

  useEffect(() => stopPython, [stopPython]);

  const runPython = () => {
    if (!code.trim() || pythonStatus !== "idle") return;
    const worker = new Worker("/python-worker.js");
    pythonWorkerRef.current = worker;
    setPythonOutput([]);
    setPythonStatus("loading");
    const appendOutput = (stream: "stdout" | "stderr", text: string) =>
      setPythonOutput((current) => [...current.slice(-499), { stream, text }]);

    worker.onmessage = (event: MessageEvent<{
      type: "status" | "output" | "done" | "error";
      status?: "loading" | "running";
      stream?: "stdout" | "stderr";
      text?: string;
    }>) => {
      const message = event.data;
      if (message.type === "status" && message.status) {
        setPythonStatus(message.status);
        if (message.status === "running") {
          // Execution time limit; loading Pyodide itself is not counted.
          pythonTimeoutRef.current = window.setTimeout(() => {
            stopPython();
            appendOutput("stderr", "Execuția a fost oprită după 10 secunde.");
          }, 10_000);
        }
      } else if (message.type === "output" && message.stream && message.text !== undefined) {
        appendOutput(message.stream, message.text);
      } else if (message.type === "error") {
        appendOutput("stderr", message.text ?? "Eroare necunoscută.");
        stopPython();
      } else if (message.type === "done") {
        stopPython();
      }
    };
    worker.onerror = () => {
      appendOutput("stderr", "Nu am putut încărca executorul Python. Verifică conexiunea la internet.");
      stopPython();
    };
    worker.postMessage({ id: Date.now(), code });
  };

  const sendChatMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text || text.length > 1000) return;
    const message = {
      id: `${userId}-${Date.now()}`,
      from: userId,
      name: myName,
      text,
      sentAt: new Date().toISOString(),
    };
    try {
      await sendRoomEvent("chat", {
        name: message.name,
        text: message.text,
        sentAt: message.sentAt,
      });
      setMessages((current) => [...current, message]);
      setMessageDraft("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Mesajul nu a putut fi trimis.");
    }
  };

  const confirmSession = async () => {
    if (!accessToken) return;
    setConfirmed(true);
    try {
      const result = await fetchSkillSwapApi<{ session: SkillSwapSession }>(
        `/api/skillswap/sessions/${sessionId}`,
        accessToken,
        { method: "PATCH", body: JSON.stringify({ action: "confirm" }) },
      );
      applySessionUpdate(result.session);
      if (result.session.status === "completed") stopRoomMedia();
    } catch (error) {
      setConfirmed(false);
      setRoomError(error instanceof Error ? error.message : "Nu am putut confirma sesiunea.");
    }
  };

  const clearBoard = () => {
    const context = canvasRef.current?.getContext("2d");
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    void sendRoomEvent("board", { action: "clear" }).catch((error: unknown) => setRoomError(
      error instanceof Error ? error.message : "Nu am putut sincroniza tabla.",
    ));
  };

  const formatCountdown = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="section-page skillswap-room-page">
        <div className="skillswap-feedback">Se încarcă sala SkillSwap…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="section-page skillswap-room-page">
        <Link className="skillswap-back-link" href="/skillswap">← Înapoi la SkillSwap</Link>
        <div className="skillswap-feedback error" role="alert">
          {roomError || "Sesiunea nu a putut fi încărcată."}
        </div>
      </div>
    );
  }

  const roomAvailable = ["accepted", "awaiting_confirmation"].includes(session.status);
  const sessionStarted = (sessionTiming?.secondsUntilStart ?? 1) === 0;
  const sessionStatusText = session.status === "awaiting_confirmation"
    ? "Așteaptă confirmarea ambilor participanți"
    : session.status === "completed"
      ? "Sesiune finalizată"
      : session.status === "accepted"
        ? sessionStarted
          ? "Sesiune în desfășurare"
          : `Începe în ${formatCountdown(sessionTiming?.secondsUntilStart ?? null)}`
        : "Sala este disponibilă după acceptarea sesiunii";

  return (
    <div className="section-page skillswap-room-page">
      <header className="skillswap-room-header">
        <div>
          <Link className="skillswap-back-link" href="/skillswap">← Înapoi la SkillSwap</Link>
          <p className="skillswap-eyebrow">SALA DE SCHIMB</p>
          <h1>{session.skill}</h1>
          <p className="skillswap-room-subtitle">
            {myName} și {peerName} · {sessionStatusText}
          </p>
        </div>
        <div className="skillswap-room-timer" aria-live="polite">
          <span>{session.status === "awaiting_confirmation" ? "De confirmat" : "Timp rămas"}</span>
          <strong>
            {formatCountdown(session.status === "accepted"
              ? sessionTiming?.secondsRemaining ?? null
              : 0)}
          </strong>
        </div>
      </header>

      {roomError && <div className="skillswap-feedback error" role="alert">{roomError}</div>}
      {!turnConfigured && localStream && (
        <div className="skillswap-feedback">
          Apelul folosește STUN. Configurează un server TURN pentru conectare stabilă în rețele restrictive.
        </div>
      )}

      <div className="skillswap-room-layout">
        <section className="skillswap-call-card">
          <div className="skillswap-video-grid">
            <div className="skillswap-video-tile">
              <video autoPlay className="skillswap-video" muted playsInline ref={localVideoRef} />
              {!localStream && <div className="skillswap-video-placeholder">Camera ta apare aici</div>}
              <span className="skillswap-video-name">{myName} (tu)</span>
            </div>
            <div className="skillswap-video-tile">
              <video autoPlay className="skillswap-video" playsInline ref={remoteVideoRef} />
              {!remoteStream && (
                <div className="skillswap-video-placeholder">
                  {localStream ? `Se așteaptă ${peerName}…` : `${peerName} apare aici`}
                </div>
              )}
              <span className="skillswap-video-name">{peerName}</span>
            </div>
          </div>
          <div className="skillswap-call-controls">
            {!localStream ? (
              <button
                className="skillswap-primary-button"
                disabled={!roomAvailable || !realtimeReady || mediaStarting || !sessionStarted}
                onClick={() => void startMedia()}
                type="button"
              >
                {mediaStarting
                  ? "Se conectează…"
                  : !sessionStarted && session.status === "accepted"
                    ? "Poți intra la ora programată"
                    : !realtimeReady
                      ? "Se conectează sala…"
                      : "Intră în apel"}
              </button>
            ) : (
              <>
                <button
                  aria-pressed={!microphoneEnabled}
                  className="skillswap-control-button"
                  onClick={toggleMicrophone}
                  type="button"
                >
                  {microphoneEnabled ? "Oprește microfonul" : "Pornește microfonul"}
                </button>
                <button
                  aria-pressed={!cameraEnabled}
                  className="skillswap-control-button"
                  onClick={toggleCamera}
                  type="button"
                >
                  {cameraEnabled ? "Oprește camera" : "Pornește camera"}
                </button>
                <button className="skillswap-danger-button" onClick={leaveMedia} type="button">
                  Părăsește apelul
                </button>
              </>
            )}
          </div>
          {!roomAvailable && (
            <p className="skillswap-room-note">
              Sesiunea trebuie acceptată înainte să poți porni apelul.
            </p>
          )}
        </section>

        <section className="skillswap-workspace">
          <div className="skillswap-panel-tabs" role="tablist" aria-label="Instrumente de colaborare">
            <button
              aria-selected={activePanel === "board"}
              onClick={() => setActivePanel("board")}
              role="tab"
              type="button"
            >
              Tablă
            </button>
            <button
              aria-selected={activePanel === "code"}
              onClick={() => setActivePanel("code")}
              role="tab"
              type="button"
            >
              Cod
            </button>
            <button
              aria-selected={activePanel === "chat"}
              onClick={() => setActivePanel("chat")}
              role="tab"
              type="button"
            >
              Chat
            </button>
          </div>

          {activePanel === "board" && (
            <div className="skillswap-board-panel">
              <div className="skillswap-panel-heading">
                <div>
                  <h2>Tablă colaborativă</h2>
                  <p>Desenele se sincronizează live între participanți.</p>
                </div>
                <button className="skillswap-control-button" onClick={clearBoard} type="button">
                  Șterge tabla
                </button>
              </div>
              <canvas
                aria-label="Tablă colaborativă"
                className="skillswap-board-canvas"
                height={550}
                onPointerCancel={() => { drawingRef.current = false; }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => { drawingRef.current = false; }}
                ref={canvasRef}
                width={900}
              />
            </div>
          )}

          {activePanel === "code" && (
            <div className="skillswap-code-panel">
              <div className="skillswap-panel-heading">
                <div>
                  <h2>Cod partajat</h2>
                  <p>Scrie cod Python și rulează-l direct în browser.</p>
                </div>
                {pythonStatus === "idle" ? (
                  <button
                    className="skillswap-primary-button skillswap-run-button"
                    disabled={!code.trim()}
                    onClick={runPython}
                    type="button"
                  >
                    ▶ Rulează Python
                  </button>
                ) : (
                  <button className="skillswap-danger-button skillswap-run-button" onClick={stopPython} type="button">
                    ■ Oprește
                  </button>
                )}
              </div>
                <textarea
                  aria-label="Cod partajat"
                  className="skillswap-code-editor"
                  maxLength={20_000}
                onChange={(event) => handleCodeChange(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    runPython();
                  }
                }}
                placeholder={"# Scrieți aici un exemplu Python împreună\nprint('Salut!')\n"}
                spellCheck={false}
                value={code}
              />
              <pre aria-live="polite" className="skillswap-code-output">
                {pythonStatus === "loading" && "Se încarcă Python (prima rulare durează câteva secunde)…"}
                {pythonStatus !== "loading" && pythonOutput.length === 0 && (
                  <span className="skillswap-code-output-hint">Rezultatul apare aici (Ctrl+Enter pentru rulare).</span>
                )}
                {pythonOutput.map((line, index) => (
                  <span className={line.stream === "stderr" ? "skillswap-code-error" : undefined} key={index}>
                    {line.text}
                    {"\n"}
                  </span>
                ))}
              </pre>
            </div>
          )}

          {activePanel === "chat" && (
            <div className="skillswap-chat-panel">
              <div aria-live="polite" className="skillswap-chat-messages">
                {messages.length === 0 && (
                  <p className="skillswap-empty-state">Conversația live începe aici.</p>
                )}
                {messages.map((message) => (
                  <article
                    className={`skillswap-chat-message${message.from === userId ? " own" : ""}`}
                    key={message.id}
                  >
                    <strong>{message.name}</strong>
                    <p>{message.text}</p>
                    <time dateTime={message.sentAt}>
                      {new Intl.DateTimeFormat("ro-RO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(message.sentAt))}
                    </time>
                  </article>
                ))}
              </div>
              <form className="skillswap-chat-form" onSubmit={(event) => void sendChatMessage(event)}>
                <input
                  aria-label="Mesaj pentru partener"
                  maxLength={1000}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder="Scrie un mesaj…"
                  value={messageDraft}
                />
                <button
                  aria-label="Trimite mesajul"
                  className="skillswap-primary-button"
                  disabled={!messageDraft.trim() || !realtimeReady}
                  type="submit"
                >
                  <Icon name="send" size={18} />
                </button>
              </form>
              <p className="skillswap-room-note">Mesajele din chat sunt temporare și nu se salvează.</p>
            </div>
          )}
        </section>
      </div>

      {session.status === "awaiting_confirmation" && (
        <section className="skillswap-confirm-card">
          <div>
            <h2>Confirmă finalizarea</h2>
            <p>
              Confirmarea este individuală. Sesiunea se marchează ca finalizată doar după ce
              ambii participanți confirmă.
            </p>
          </div>
          <button
            className="skillswap-primary-button"
            disabled={confirmed || (
              userId === session.teacher_id
                ? Boolean(session.teacher_confirmed_at)
                : Boolean(session.learner_confirmed_at)
            )}
            onClick={() => void confirmSession()}
            type="button"
          >
            {confirmed ? "Confirmare trimisă" : "Confirmă sesiunea"}
          </button>
        </section>
      )}
      {session.status === "accepted" &&
        sessionTiming?.secondsRemaining === 0 &&
        roomError && (
          <button
            className="skillswap-control-button skillswap-finish-retry"
            onClick={() => void finishSession()}
            type="button"
          >
            Reîncearcă încheierea sesiunii
          </button>
        )}

      <p className="skillswap-room-footer">
        Nu împărtăși date sensibile în chat. Dacă a apărut o problemă, raporteaz-o din pagina SkillSwap.
      </p>
    </div>
  );
}
