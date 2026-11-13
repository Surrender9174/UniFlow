"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import type {
  EmailTask,
  TaskAction,
  WhatsAppAnalysis,
  WhatsAppEvent,
} from "@/lib/email-analysis";
import {
  addSavedTasks,
  formatSavedTaskDueAt,
  type SavedTask,
} from "@/lib/tasks";

type Message = {
  role: "assistant" | "student";
  text: string;
  time: string;
  tasks?: EmailTask[];
  savedTasks?: SavedTask[];
  whatsappEvents?: WhatsAppEvent[];
  savedWhatsAppEventIndexes?: number[];
};

type GmailStatus = {
  connected: boolean;
  email: string | null;
};

type AnalysisResult = {
  reply: string;
  tasks: EmailTask[];
  taskAction: TaskAction;
  emailCount: number;
  inboxAvailable: boolean;
};

const MAX_WHATSAPP_EXPORT_BYTES = 200 * 1024;

function isEmailTask(value: unknown): value is EmailTask {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    "dueDate" in value &&
    (value.dueDate === null || typeof value.dueDate === "string") &&
    "dueAt" in value &&
    (value.dueAt === null || typeof value.dueAt === "string") &&
    "priority" in value &&
    (value.priority === "high" || value.priority === "normal") &&
    "sourceSubject" in value &&
    typeof value.sourceSubject === "string" &&
    "reason" in value &&
    typeof value.reason === "string"
  );
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  const taskAction =
    typeof value === "object" && value !== null && "taskAction" in value
      ? value.taskAction
      : null;
  return (
    typeof value === "object" &&
    value !== null &&
    "reply" in value &&
    typeof value.reply === "string" &&
    "tasks" in value &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isEmailTask) &&
    isTaskAction(taskAction) &&
    "emailCount" in value &&
    typeof value.emailCount === "number" &&
    Number.isInteger(value.emailCount) &&
    value.emailCount >= 0 &&
    "inboxAvailable" in value &&
    typeof value.inboxAvailable === "boolean"
  );
}

function isTaskAction(value: unknown): value is TaskAction {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value.status === "none" ||
      value.status === "needs_details" ||
      value.status === "create") &&
    "tasks" in value &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTaskActionItem)
  );
}

function isTaskActionItem(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    typeof value.title === "string" &&
    "subject" in value &&
    typeof value.subject === "string" &&
    "dueAt" in value &&
    typeof value.dueAt === "string" &&
    "category" in value &&
    (value.category === "Studiu" ||
      value.category === "Practică" ||
      value.category === "Test")
  );
}

function isWhatsAppEvent(value: unknown): value is WhatsAppEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value.type === "test" ||
      value.type === "oral_assessment" ||
      value.type === "class" ||
      value.type === "cancellation" ||
      value.type === "deadline" ||
      value.type === "schedule_change" ||
      value.type === "other") &&
    "status" in value &&
    (value.status === "scheduled" ||
      value.status === "cancelled" ||
      value.status === "rescheduled" ||
      value.status === "info") &&
    "title" in value &&
    typeof value.title === "string" &&
    "course" in value &&
    typeof value.course === "string" &&
    "dateTime" in value &&
    typeof value.dateTime === "string" &&
    "dateText" in value &&
    typeof value.dateText === "string" &&
    "details" in value &&
    typeof value.details === "string" &&
    "sourceExcerpt" in value &&
    typeof value.sourceExcerpt === "string"
  );
}

function isWhatsAppAnalysis(value: unknown): value is WhatsAppAnalysis {
  return (
    typeof value === "object" &&
    value !== null &&
    "summary" in value &&
    typeof value.summary === "string" &&
    "events" in value &&
    Array.isArray(value.events) &&
    value.events.every(isWhatsAppEvent)
  );
}

const whatsappEventTypeLabels: Record<WhatsAppEvent["type"], string> = {
  test: "Test / examen",
  oral_assessment: "Ascultare",
  class: "Oră de curs",
  cancellation: "Anulare",
  deadline: "Termen",
  schedule_change: "Modificare program",
  other: "Anunț școlar",
};

const whatsappEventStatusLabels: Record<WhatsAppEvent["status"], string> = {
  scheduled: "Programat",
  cancelled: "Anulat",
  rescheduled: "Reprogramat",
  info: "Informare",
};
const starterMessages: Message[] = [
  {
    role: "assistant",
    text: "Hei! Sunt Uni, study buddy-ul tău. Conectează Gmail pentru întrebări despre inbox sau cere-mi să-ți adaug un task pentru școală ori facultate, cu dată și oră.",
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
  const [whatsappFile, setWhatsAppFile] = useState<File | null>(null);
  const [whatsappError, setWhatsAppError] = useState("");
  const whatsappFileInput = useRef<HTMLInputElement>(null);
  const savedWhatsAppEventKeys = useRef(new Set<string>());

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
    if (!text || loading) return;

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
            .slice(-4)
            .map((message) => ({
              role: message.role === "student" ? "user" : "assistant",
              content: message.text.slice(0, 800),
            })),
          timeContext: {
            currentTime: new Date().toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
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
      const savedTasks =
        result.taskAction.status === "create"
          ? addSavedTasks(
              result.taskAction.tasks.map((task) => ({
                title: task.title,
                subject: task.subject || "Școală / facultate",
                dueAt: task.dueAt,
                category: task.category,
              })),
            )
          : [];
      const answer =
        result.inboxAvailable && result.emailCount === 0
          ? `${result.reply} Nu am găsit emailuri în Inbox din ultimele 30 de zile.`
          : result.reply;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: answer,
          time: currentTime(),
          tasks: result.tasks,
          savedTasks: savedTasks.length > 0 ? savedTasks : undefined,
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

  const selectWhatsAppFile = (event: ChangeEvent<HTMLInputElement>) => {
    setWhatsAppError("");
    setWhatsAppFile(event.currentTarget.files?.[0] ?? null);
  };

  const analyzeWhatsAppChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!whatsappFile || loading) return;
    if (!whatsappFile.name.toLowerCase().endsWith(".txt")) {
      setWhatsAppError("Alege un export WhatsApp în format .txt.");
      return;
    }
    if (whatsappFile.size > MAX_WHATSAPP_EXPORT_BYTES) {
      setWhatsAppError("Fișierul depășește 200 KB. Exportă un interval mai scurt.");
      return;
    }

    setWhatsAppError("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      {
        role: "student",
        text: `Analizează exportul WhatsApp: ${whatsappFile.name}`,
        time: currentTime(),
      },
    ]);

    try {
      const formData = new FormData();
      formData.set("file", whatsappFile);
      formData.set("currentTime", new Date().toISOString());
      formData.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);

      const response = await fetch("/api/assistant/whatsapp", {
        method: "POST",
        body: formData,
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Nu am putut analiza exportul WhatsApp.",
        );
      }
      if (!isWhatsAppAnalysis(result)) {
        throw new Error("Răspuns invalid de la analiza WhatsApp.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            result.events.length > 0
              ? result.summary
              : `${result.summary} Nu am găsit anunțuri școlare clare în export.`,
          time: currentTime(),
          whatsappEvents: result.events,
        },
      ]);
      setWhatsAppFile(null);
      if (whatsappFileInput.current) whatsappFileInput.current.value = "";
    } catch (requestError: unknown) {
      setWhatsAppError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut analiza exportul WhatsApp.",
      );
    } finally {
      setLoading(false);
    }
  };

  const addWhatsAppEventToTasks = (
    messageIndex: number,
    eventIndex: number,
    item: WhatsAppEvent,
  ) => {
    const eventKey = `${messageIndex}:${eventIndex}`;
    if (savedWhatsAppEventKeys.current.has(eventKey)) return;

    try {
      setWhatsAppError("");
      savedWhatsAppEventKeys.current.add(eventKey);
      const subject = [item.course, !item.dateTime ? item.dateText : ""]
        .filter(Boolean)
        .join(" · ");
      addSavedTasks([
        {
          title: item.title,
          subject: subject || "Școală / facultate",
          dueAt: item.dateTime || null,
          category:
            item.type === "test" || item.type === "oral_assessment"
              ? "Test"
              : item.type === "class"
                ? "Practică"
                : "Studiu",
        },
      ]);
      setMessages((current) =>
        current.map((message, index) =>
          index === messageIndex
            ? {
                ...message,
                savedWhatsAppEventIndexes: [
                  ...(message.savedWhatsAppEventIndexes ?? []),
                  eventIndex,
                ],
              }
            : message,
        ),
      );
    } catch (requestError: unknown) {
      savedWhatsAppEventKeys.current.delete(eventKey);
      setWhatsAppError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut adăuga anunțul în task-uri.",
      );
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
          <p className="muted">Întreabă despre emailuri sau planifică task-uri pentru școală și facultate.</p>
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
          Gmail este accesat doar pentru citire și este căutat numai când mesajul tău
          menționează emailuri, Inbox, Gmail sau mesaje. Atunci, până la 5 mesaje din
          ultimele 30 de zile sunt trimise către Gemini. Pentru celelalte întrebări,
          Gmail nu este accesat. Pe planul gratuit, Google poate folosi conținutul trimis
          pentru îmbunătățirea produselor. UniFlow nu salvează emailurile. Task-urile
          sunt salvate local în browserul acesta. Deconectarea șterge sesiunea locală;
          poți revoca accesul aplicației și din setările contului Google.
        </p>
      </section>

      <section aria-label="Importă export WhatsApp" className="gmail-connection card-surface whatsapp-upload">
        <form className="gmail-connection-main whatsapp-upload-main" onSubmit={analyzeWhatsAppChat}>
          <span className="gmail-connection-icon"><Icon name="file" size={19} /></span>
          <div className="gmail-connection-copy">
            <strong>Analizează un export WhatsApp</strong>
            <p>Alege conversația exportată ca fișier .txt, până la 200 KB.</p>
          </div>
          <input
            accept=".txt,text/plain"
            aria-label="Alege export WhatsApp în format .txt"
            className="whatsapp-file-input"
            disabled={loading}
            onChange={selectWhatsAppFile}
            ref={whatsappFileInput}
            type="file"
          />
          <button
            className="button button-secondary"
            disabled={!whatsappFile || loading}
            type="submit"
          >
            Analizează
          </button>
        </form>
        {whatsappFile && <p className="whatsapp-file-selected">{whatsappFile.name}</p>}
        {whatsappError && <p className="gmail-status-error" role="alert">{whatsappError}</p>}
        <p className="gmail-privacy-note">
          Fișierul este trimis la Gemini pentru analiză și nu este salvat în UniFlow.
          Pe planul gratuit, Google poate folosi conținutul pentru îmbunătățirea produselor.
          Înainte de încărcare, elimină informațiile private pe care nu vrei să le partajezi.
        </p>
      </section>

      <section className="chat-panel card-surface">
        <header className="chat-header">
          <span className="chat-avatar"><Icon name="sparkles" size={21} /></span>
          <div>
            <strong>Uni <span>AI study buddy</span></strong>
            <small><i /> {gmailStatus?.connected ? "Pregătit să te ajut" : "Uni e pregătit"}</small>
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
                {message.savedTasks?.map((task) => (
                  <article className="email-task-card" key={task.id}>
                    <div className="email-task-heading">
                      <strong>{task.title}</strong>
                      <span className="email-task-priority">Adăugat în task-uri</span>
                    </div>
                    <small>
                      {task.subject} · {formatSavedTaskDueAt(task.dueAt)}
                    </small>
                    <Link className="text-link" href="/tasks">Vezi lista de task-uri</Link>
                  </article>
                ))}
                {message.whatsappEvents?.map((item, eventIndex) => (
                  <article
                    className="email-task-card"
                    key={`${item.type}-${item.title}-${eventIndex}`}
                  >
                    <div className="email-task-heading">
                      <strong>{whatsappEventTypeLabels[item.type]}: {item.title}</strong>
                      <span className={`email-task-priority ${item.status}`}>
                        {whatsappEventStatusLabels[item.status]}
                      </span>
                    </div>
                    <p>{item.details}</p>
                    <small>
                      {item.dateTime
                        ? formatSavedTaskDueAt(item.dateTime)
                        : item.dateText || "Dată și oră neprecizate"}
                      {item.course ? ` · ${item.course}` : ""}
                    </small>
                    {item.sourceExcerpt && <small>Din conversație: “{item.sourceExcerpt}”</small>}
                    {item.status === "cancelled" ? (
                      <small>Anulările sunt afișate aici, dar nu sunt adăugate ca task-uri.</small>
                    ) : message.savedWhatsAppEventIndexes?.includes(eventIndex) ? (
                      <>
                        <span className="email-task-priority">Adăugat în task-uri</span>
                        <Link className="text-link" href="/tasks">Vezi lista de task-uri</Link>
                      </>
                    ) : (
                      <button
                        className="text-link whatsapp-add-task"
                        onClick={() => addWhatsAppEventToTasks(index, eventIndex, item)}
                        type="button"
                      >
                        Adaugă la task-uri
                      </button>
                    )}
                  </article>
                ))}
                <span className="chat-time">{message.time}</span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="assistant-thinking" role="status">
              Uni pregătește un răspuns...
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
            aria-label="Întreabă-l pe Uni sau adaugă un task"
            disabled={loading}
            maxLength={600}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Întreabă-l pe Uni sau cere-i să adauge un task..."
            value={draft}
          />
          <button
            aria-label="Trimite mesajul"
            className="send-button"
            disabled={!draft.trim() || loading}
            type="submit"
          >
            <Icon name="send" size={17} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Răspunsurile sunt generate cu AI. Verifică atent datele și cerințele importante.
        </p>
      </section>
    </div>
  );
}
