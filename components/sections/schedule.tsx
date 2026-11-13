import Link from "next/link";
import { Icon } from "@/components/icons";

const weekDays = [
  { day: "LUN", date: "23", today: true },
  { day: "MAR", date: "24" },
  { day: "MIE", date: "25" },
  { day: "JOI", date: "26" },
  { day: "VIN", date: "27" },
];
const classes = [
  { start: "08:00", end: "09:30", title: "Algoritmi și structuri de date", type: "Seminar", room: "Laborator 3 · Corp C", color: "schedule-lilac", time: "08:00", duration: "90m" },
  { start: "10:00", end: "11:30", title: "Metode empirice în informatică", type: "Curs", room: "Sala 204 · Facultatea de Matematică", color: "schedule-blue", time: "10:00", duration: "90m" },
  { start: "13:00", end: "14:30", title: "Sisteme de gestiune a bazelor de date", type: "Laborator", room: "Laborator 1 · Corp C", color: "schedule-green", time: "13:00", duration: "90m" },
  { start: "15:00", end: "16:30", title: "Etică profesională", type: "Curs", room: "Amfiteatrul Spiru Haret", color: "schedule-peach", time: "15:00", duration: "90m" },
];

export default function SchedulePage() {
  return (
    <div className="section-page">
      <div className="page-heading schedule-heading">
        <div><p className="eyebrow">SEMESTRUL II · 2025–2026</p><h1>Orarul meu</h1><p className="muted">O săptămână bine organizată începe aici.</p></div>
        <Link className="button button-secondary" href="/materials"><Icon name="upload" size={17} /> Importă orarul</Link>
      </div>
      <section className="card-surface week-picker" aria-label="Selectează ziua săptămânii">
        <button aria-label="Săptămâna anterioară" className="week-arrow" type="button"><span>‹</span></button>
        <div className="week-days">{weekDays.map((day) => <button className={`week-day${day.today ? " selected" : ""}`} key={day.day} type="button"><span>{day.day}</span><strong>{day.date}</strong>{day.today && <i />}</button>)}</div>
        <button aria-label="Săptămâna următoare" className="week-arrow" type="button"><span>›</span></button>
        <span className="week-range">23 — 27 mar. 2026</span>
      </section>
      <section className="schedule-board">
        <div className="schedule-date"><span className="today-tag">LUNI</span><h2>23 martie</h2><p>4 cursuri <span>·</span> 6 ore în campus</p></div>
        <div className="schedule-timeline">{classes.map((item, index) => <article className="schedule-item" key={item.title}><div className="schedule-time"><strong>{item.time}</strong><span>{item.duration}</span></div><div className={`schedule-event ${item.color}`}><span className="event-type">{item.type}</span><h3>{item.title}</h3><p><Icon name="map" size={14} />{item.room}</p></div>{index === 1 && <span className="current-time-line"><i /> ACUM</span>}</article>)}</div>
      </section>
      <div className="schedule-tip"><span><Icon name="sparkles" size={18} /></span><p><strong>Mic reminder:</strong> ai 30 de minute libere între cursul de la 11:30 și următorul task. Pauza de cafea e meritată.</p></div>
    </div>
  );
}
