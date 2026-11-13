"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import type { EmailTask } from "@/lib/email-analysis";

type Message = {
  role: "assistant" | "student";
  text: string;
  time: string;
  tasks?: EmailTask[];
};

type GmailStatus = {
  connected: boolean;
  email: string | null;
};

type AnalysisResult = {
  reply: string;
  tasks: EmailTask[];
  emailCount: number;
};

function isEmailTask(value: unknown): value is EmailTask {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    "dueDate" in value &&
    (value.dueDate === null || typeof value.dueDate === "string") &&
    "priority" in value &&
    (value.priority === "high" || value.priority === "normal") &&
    "sourceSubject" in value &&
    typeof value.sourceSubject === "string" &&
    "reason" in value &&
    typeof value.reason === "string"
  );
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "reply" in value &&
    typeof value.reply === "string" &&
    "tasks" in value &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isEmailTask) &&
    "emailCount" in value &&
    typeof value.emailCount === "number" &&
    Number.isInteger(value.emailCount) &&
    value.emailCount >= 0
  );
}

const starterMessages: Message[] = [
  {
    role: "assistant",
    text: "Hei! Sunt Uni, study buddy-ul tău. Conectează Gmail ca să găsim împreună mesajele importante și ce ai de făcut.",
    time: "Acum",
  },
];
const suggestions = [
  "Ce trebuie să fac din emailurile recente?",
  "Găsește deadline-urile din inbox",
  "Ce mesaje ar trebui să prioritizez?",
];

function currentTime() {
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function getGmailNotice(status: string) {
  if (status === "connected") return "Gmail a fost conectat.";
  if (status === "denied") return "Conectarea Gmail a fost anulată.";
  if (status === "setup-error") {
    return "Gmail nu este configurat încă. Verifică variabilele GOOGLE_* și GMAIL_SESSION_SECRET.";
  }
  if (status === "state-error") {
    return "Verificarea de securitate OAuth a eșuat. Încearcă din nou să conectezi Gmail.";
  }
  if (status === "connect-error") {
    return "Nu am putut conecta Gmail. Verifică setările OAuth și încearcă din nou.";
  }
  return null;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState("");
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailStatusError, setGmailStatusError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const gmailNotice = getGmailNotice(url.searchParams.get("gmail") ?? "");
    if (url.searchParams.has("gmail")) {
      url.searchParams.delete("gmail");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    void fetch("/api/gmail/status", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            typeof result === "object" &&
              result !== null &&
              "error" in result &&
              typeof result.error === "string"
              ? result.error
              : "Nu am putut verifica starea conexiunii Gmail.",
          );
        }
        if (
          typeof result !== "object" ||
          result === null ||
          !("connected" in result) ||
          typeof result.connected !== "boolean" ||
          !("email" in result) ||
          (result.email !== null && typeof result.email !== "string")
        ) {
          throw new Error("Răspuns invalid pentru starea conexiunii Gmail.");
        }
        if (gmailNotice) setNotice(gmailNotice);
        setGmailStatus({ connected: result.connected, email: result.email });
      })
      .catch((statusError: unknown) => {
        if (gmailNotice) setNotice(gmailNotice);
        setGmailStatusError(
          statusError instanceof Error
            ? statusError.message
            : "Nu am putut verifica starea conexiunii Gmail.",
        );
      });
  }, []);

  const submitQuestion = async (question: string) => {
    const text = question.trim();
    if (!text || loading || !gmailStatus?.connected) return;

    setError("");
    setMessages((current) => [
      ...current,
      { role: "student", text, time: currentTime() },
    ]);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch("/api/gmail/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          history: messages
            .slice(1)
            .slice(-8)
            .map((message) => ({
              role: message.role === "student" ? "user" : "assistant",
              content: message.text,
            })),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Nu am putut analiza emailurile.",
        );
      }
      if (!isAnalysisResult(result)) {
        throw new Error("Răspuns invalid de la asistent.");
      }
      const answer =
        result.emailCount === 0
          ? `${result.reply} Nu am găsit emailuri în Inbox din ultimele 30 de zile.`
          : result.reply;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: answer,
          time: currentTime(),
          tasks: result.tasks,
        },
      ]);
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut analiza emailurile.";
      setError(message);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: message, time: currentTime() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitQuestion(draft);
  };

  const disconnectGmail = async () => {
    setError("");
    try {
      const response = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Nu am putut șterge sesiunea Gmail.");
      setGmailStatus({ connected: false, email: null });
      setMessages(starterMessages);
      setNotice("Sesiunea Gmail a fost ștearsă din UniFlow.");
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut deconecta Gmail.",
      );
    }
  };

  return (
    <div className="section-page assistant-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ÎNTREABĂ, PLANIFICĂ, ÎNVAȚĂ</p>
          <h1>Study buddy-ul tău</h1>
          <p className="muted">Află ce merită atenția ta din emailurile recente.</p>
        </div>
        <span className="assistant-online">
          <i />
          {gmailStatus?.connected ? "Gmail conectat" : "Uni e pregătit"}
        </span>
      </div>

      <section aria-label="Conexiune Gmail" className="gmail-connection card-surface">
        <div className="gmail-connection-main">
          <span className="gmail-connection-icon"><Icon name="mail" size={19} /></span>
          <div className="gmail-connection-copy">
            <strong>
              {gmailStatus?.connected
                ? `Conectat ca ${gmailStatus.email}`
                : "Conectează-ți Gmail-ul"}
            </strong>
            <p>
              {gmailStatus?.connected
                ? "UniFlow are acces doar pentru citire."
                : "Uni poate citi mesajele recente doar după ce autorizezi accesul."}
            </p>
          </div>
          {gmailStatus?.connected ? (
            <button
              className="button button-secondary"
              disabled={loading}
              onClick={() => void disconnectGmail()}
              type="button"
            >
              Deconectează
            </button>
          ) : (
            <a className="button button-secondary" href="/api/gmail/connect">
              Conectează Gmail
            </a>
          )}
        </div>
        {gmailStatusError && <p className="gmail-status-error" role="alert">{gmailStatusError}</p>}
        {notice && <p className="gmail-notice" role="status">{notice}</p>}
        {error && <p className="gmail-status-error" role="alert">{error}</p>}
        <p className="gmail-privacy-note">
          Accesul este doar pentru citire. Când trimiți o întrebare, până la 10 mesaje
          din Inbox-ul ultimelor 30 de zile sunt trimise către Gemini pentru analiză.
          UniFlow nu salvează conținutul emailurilor. Deconectarea șterge sesiunea
          locală; poți revoca accesul aplicației și din setările contului Google.
        </p>
      </section>

      <section className="chat-panel card-surface">
        <header className="chat-header">
          <span className="chat-avatar"><Icon name="sparkles" size={21} /></span>
          <div>
            <strong>Uni <span>AI study buddy</span></strong>
            <small><i /> {gmailStatus?.connected ? "Pregătit să te ajut" : "Aștept conectarea Gmail"}</small>
          </div>
          <button aria-label="Mai multe opțiuni" className="quiet-icon" type="button">
            <Icon name="more" size={20} />
          </button>
        </header>
        <div aria-live="polite" className="chat-messages">
          <p className="chat-date">ASTĂZI</p>
          {messages.map((message, index) => (
            <div
              className={`chat-message-row ${message.role}`}
              key={`${message.time}-${index}`}
            >
              <span className="chat-message-avatar">
                {message.role === "assistant" ? <Icon name="sparkles" size={15} /> : "A"}
              </span>
              <div className="chat-message-content">
                <div className="chat-bubble">{message.text}</div>
                {message.tasks?.map((task, taskIndex) => (
                  <article className="email-task-card" key={`${task.title}-${taskIndex}`}>
                    <div className="email-task-heading">
                      <strong>{task.title}</strong>
                      <span className={`email-task-priority ${task.priority}`}>
                        {task.priority === "high" ? "Prioritar" : "De făcut"}
                      </span>
                    </div>
                    <p>{task.reason}</p>
                    <small>
                      {task.dueDate ? `Termen: ${task.dueDate}` : "Fără termen menționat"}
                      {task.sourceSubject ? ` · ${task.sourceSubject}` : ""}
                    </small>
                  </article>
                ))}
                <span className="chat-time">{message.time}</span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="assistant-thinking" role="status">
              Verific emailurile recente și pregătesc un răspuns...
            </div>
          )}
          {messages.length === 1 && gmailStatus?.connected && (
            <div className="chat-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  disabled={loading}
                  key={suggestion}
                  onClick={() => void submitQuestion(suggestion)}
                  type="button"
                >
                  {suggestion}<Icon name="arrow" size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
        <form className="chat-compose" onSubmit={sendMessage}>
          <span className="compose-attach" aria-hidden="true">
            <Icon name="mail" size={18} />
          </span>
          <input
            aria-label="Întreabă despre emailurile tale"
            disabled={!gmailStatus?.connected || loading}
            maxLength={600}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              gmailStatus?.connected
                ? "Întreabă ce ai de făcut..."
                : "Conectează Gmail pentru a continua..."
            }
            value={draft}
          />
          <button
            aria-label="Trimite mesajul"
            className="send-button"
            disabled={!draft.trim() || !gmailStatus?.connected || loading}
            type="submit"
          >
            <Icon name="send" size={17} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Răspunsurile sunt generate cu AI. Verifică datele și cerințele importante în emailul original.
        </p>
      </section>
    </div>
  );
}
