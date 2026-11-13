"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { useDeviceNow } from "@/components/use-device-now";
import { formatLocalDate, formatLocalTime, formatRelativeDeadline } from "@/lib/device-time";

type Message = { role: "assistant" | "student"; text: string; time: string };
const starterMessages: Message[] = [
  { role: "assistant", text: "Hei, Alexandra! 👋 Sunt Uni, study buddy-ul tău. Te pot ajuta cu orarul, deadline-urile sau cu un plan de învățare. Cu ce începem?", time: "" },
];
const suggestions = ["Ce cursuri am azi?", "Ajută-mă să-mi planific săptămâna", "Când e următorul deadline?"];

function getReply(message: string, now: Date) {
  const prompt = message.toLocaleLowerCase("ro");
  if (prompt.includes("orar") || prompt.includes("curs") || prompt.includes("azi")) return `Astăzi, ${formatLocalDate(now)}, ai 4 cursuri: Algoritmi și structuri de date la 08:00, Metode empirice în informatică la 10:00, Baze de date la 13:00 și Etică profesională la 15:00. Vezi toate detaliile în pagina Orar. 📚`;
  if (prompt.includes("deadline") || prompt.includes("termen") || prompt.includes("task")) return `Cel mai apropiat deadline este eseul „Etica în tehnologie”, ${formatRelativeDeadline(now, { daysFromToday: 0, time: "23:59" })}. După el urmează laboratorul de structuri de date, ${formatRelativeDeadline(now, { daysFromToday: 1, time: "12:00" })}. Hai să le luăm pe rând! ✅`;
  return "Hai să facem un plan realist: alege un task important, lucrează 25 de minute fără întreruperi, apoi ia o pauză de 5 minute. Pot să-ți verific și orarul sau deadline-urile — ce materie vrei să prioritizăm? ✨";
}

export default function AssistantPage() {
  const now = useDeviceNow();
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState("");

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const currentTime = new Date();
    const time = formatLocalTime(currentTime);
    setMessages((current) => [...current, { role: "student", text, time }, { role: "assistant", text: getReply(text, currentTime), time }]);
    setDraft("");
  };

  const sendSuggestion = (suggestion: string) => {
    const currentTime = new Date();
    const time = formatLocalTime(currentTime);
    setMessages((current) => [...current, { role: "student", text: suggestion, time }, { role: "assistant", text: getReply(suggestion, currentTime), time }]);
  };

  return (
    <div className="section-page assistant-page">
<<<<<<< Updated upstream
      <div className="page-heading"><div><p className="eyebrow">ÎNTREABĂ, PLANIFICĂ, ÎNVAȚĂ</p><h1>Study buddy-ul tău</h1><p className="muted">Un pic de claritate pentru orice zi aglomerată.</p></div><span className="assistant-online"><i /> Online</span></div>
=======
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
        <details className="gmail-privacy-disclosure">
          <summary>Detalii privind confidențialitatea Gmail</summary>
          <p className="gmail-privacy-note">
            Gmail este accesat doar pentru citire și este căutat numai când mesajul tău
            menționează emailuri, Inbox, Gmail sau mesaje. Atunci, până la 5 mesaje din
            ultimele 30 de zile sunt trimise către Gemini. Pentru celelalte întrebări,
            Gmail nu este accesat. Pe planul gratuit, Google poate folosi conținutul trimis
            pentru îmbunătățirea produselor. UniFlow nu salvează emailurile. Task-urile
            și istoricul conversației sunt salvate local în browserul acesta, fără
            sincronizare între dispozitive. Deconectarea șterge sesiunea Gmail locală;
            poți revoca accesul aplicației și din setările contului Google.
          </p>
        </details>
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
        <details className="gmail-privacy-disclosure">
          <summary>Detalii privind confidențialitatea exportului</summary>
          <p className="gmail-privacy-note">
            Fișierul este trimis la Gemini pentru analiză și nu este salvat în UniFlow.
            Pe planul gratuit, Google poate folosi conținutul pentru îmbunătățirea produselor.
            Înainte de încărcare, elimină informațiile private pe care nu vrei să le partajezi.
          </p>
        </details>
      </section>

>>>>>>> Stashed changes
      <section className="chat-panel card-surface">
        <header className="chat-header"><span className="chat-avatar"><Icon name="sparkles" size={21} /></span><div><strong>Uni <span>AI study buddy</span></strong><small><i /> Aici să te ajut</small></div><button aria-label="Mai multe opțiuni" className="quiet-icon" type="button"><Icon name="more" size={20} /></button></header>
        <div aria-live="polite" className="chat-messages">
          <p className="chat-date">{now ? formatLocalDate(now).toLocaleUpperCase("ro-RO") : "ASTĂZI"}</p>
          {messages.map((message, index) => <div className={`chat-message-row ${message.role}`} key={`${message.time}-${index}`}><span className="chat-message-avatar">{message.role === "assistant" ? <Icon name="sparkles" size={15} /> : "A"}</span><div className="chat-message-content"><div className="chat-bubble">{message.text}</div><span className="chat-time">{message.time || (index === 0 && now ? formatLocalTime(now) : "")}</span></div></div>)}
          {messages.length === 1 && <div className="chat-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => sendSuggestion(suggestion)} type="button">{suggestion}<Icon name="arrow" size={13} /></button>)}</div>}
        </div>
        <form className="chat-compose" onSubmit={sendMessage}><button aria-label="Atașează un fișier" className="compose-attach" type="button"><Icon name="paperclip" size={18} /></button><input aria-label="Scrie un mesaj" onChange={(event) => setDraft(event.target.value)} placeholder="Întreabă-mă orice despre facultate..." value={draft} /><button aria-label="Trimite mesajul" className="send-button" disabled={!draft.trim()} type="submit"><Icon name="send" size={17} /></button></form>
        <p className="chat-disclaimer">Uni este în versiune demo și răspunsurile sunt orientative.</p>
      </section>
    </div>
  );
}
