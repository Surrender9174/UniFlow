"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";

type Message = { role: "assistant" | "student"; text: string; time: string };
const starterMessages: Message[] = [
  { role: "assistant", text: "Hei, Alexandra! 👋 Sunt Uni, study buddy-ul tău. Te pot ajuta cu orarul, deadline-urile sau cu un plan de învățare. Cu ce începem?", time: "09:41" },
];
const suggestions = ["Ce cursuri am azi?", "Ajută-mă să-mi planific săptămâna", "Când e următorul deadline?"];

function getReply(message: string) {
  const prompt = message.toLocaleLowerCase("ro");
  if (prompt.includes("orar") || prompt.includes("curs") || prompt.includes("azi")) return "Astăzi ai 4 cursuri: Algoritmi și structuri de date la 09:00, Metode empirice în informatică la 10:00, Baze de date la 13:00 și Etică profesională la 15:00. Vezi toate detaliile în pagina Orar. 📚";
  if (prompt.includes("deadline") || prompt.includes("termen") || prompt.includes("task")) return "Cel mai apropiat deadline este eseul „Etica în tehnologie”, astăzi la 23:59. După el urmează laboratorul de structuri de date, mâine la 12:00. Hai să le luăm pe rând! ✅";
  return "Hai să facem un plan realist: alege un task important, lucrează 25 de minute fără întreruperi, apoi ia o pauză de 5 minute. Pot să-ți verific și orarul sau deadline-urile — ce materie vrei să prioritizăm? ✨";
}

export default function AssistantPage() {
  const [messages, setMessages] = useState(starterMessages);
  const [draft, setDraft] = useState("");

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setMessages((current) => [...current, { role: "student", text, time }, { role: "assistant", text: getReply(text), time }]);
    setDraft("");
  };

  const sendSuggestion = (suggestion: string) => {
    const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setMessages((current) => [...current, { role: "student", text: suggestion, time }, { role: "assistant", text: getReply(suggestion), time }]);
  };

  return (
    <div className="section-page assistant-page">
      <div className="page-heading"><div><p className="eyebrow">ÎNTREABĂ, PLANIFICĂ, ÎNVAȚĂ</p><h1>Study buddy-ul tău</h1><p className="muted">Un pic de claritate pentru orice zi aglomerată.</p></div><span className="assistant-online"><i /> Online</span></div>
      <section className="chat-panel card-surface">
        <header className="chat-header"><span className="chat-avatar"><Icon name="sparkles" size={21} /></span><div><strong>Uni <span>AI study buddy</span></strong><small><i /> Aici să te ajut</small></div><button aria-label="Mai multe opțiuni" className="quiet-icon" type="button"><Icon name="more" size={20} /></button></header>
        <div aria-live="polite" className="chat-messages">
          <p className="chat-date">ASTĂZI</p>
          {messages.map((message, index) => <div className={`chat-message-row ${message.role}`} key={`${message.time}-${index}`}><span className="chat-message-avatar">{message.role === "assistant" ? <Icon name="sparkles" size={15} /> : "A"}</span><div className="chat-message-content"><div className="chat-bubble">{message.text}</div><span className="chat-time">{message.time}</span></div></div>)}
          {messages.length === 1 && <div className="chat-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => sendSuggestion(suggestion)} type="button">{suggestion}<Icon name="arrow" size={13} /></button>)}</div>}
        </div>
        <form className="chat-compose" onSubmit={sendMessage}><button aria-label="Atașează un fișier" className="compose-attach" type="button"><Icon name="paperclip" size={18} /></button><input aria-label="Scrie un mesaj" onChange={(event) => setDraft(event.target.value)} placeholder="Întreabă-mă orice despre facultate..." value={draft} /><button aria-label="Trimite mesajul" className="send-button" disabled={!draft.trim()} type="submit"><Icon name="send" size={17} /></button></form>
        <p className="chat-disclaimer">Uni este în versiune demo și răspunsurile sunt orientative.</p>
      </section>
    </div>
  );
}
