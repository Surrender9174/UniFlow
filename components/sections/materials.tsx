"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/icons";

type ImportState = "idle" | "processing" | "done";

export default function MaterialsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [importState, setImportState] = useState<ImportState>("idle");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError("");
    setAdded(false);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Te rugăm să alegi un fișier PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Fișierul depășește limita de 15 MB.");
      event.target.value = "";
      return;
    }
    setFileName(file.name);
    setImportState("processing");
    window.setTimeout(() => setImportState("done"), 1400);
  };

  return (
    <div className="section-page materials-page">
      <div className="page-heading"><div><p className="eyebrow">IMPORT INTELIGENT</p><h1>Materialele tale</h1><p className="muted">Transformă un PDF cu programă sau orar într-un plan clar.</p></div></div>
      <div className="ingestion-layout">
        <section className="card-surface upload-card">
          <div className="upload-title"><span className="upload-icon"><Icon name="upload" size={21} /></span><div><h2>Încarcă un document</h2><p>Extragem automat cursuri, deadline-uri și examene.</p></div></div>
          <button className={`drop-zone${importState === "done" ? " upload-complete" : ""}`} onClick={() => inputRef.current?.click()} type="button">
            <span className="drop-icon"><Icon name={importState === "done" ? "check" : "file"} size={25} /></span>
            {importState === "idle" ? <><strong>Trage fișierul aici sau <em>alege un fișier</em></strong><small>PDF până la 15 MB · Programa sau orarul tău</small></> : importState === "processing" ? <><strong>Analizăm documentul tău...</strong><small>{fileName} · identificăm datele importante</small><span className="processing-line"><i /></span></> : <><strong>Document analizat cu succes</strong><small>{fileName} · am găsit 3 evenimente</small></>}
          </button>
          <input accept="application/pdf,.pdf" className="visually-hidden" onChange={chooseFile} ref={inputRef} type="file" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="privacy-note"><Icon name="settings" size={15} /><span>Fișierele tale sunt folosite doar pentru organizarea spațiului tău de studiu.</span></div>
        </section>
        <aside className="ingestion-side-card">
          <span className="ingestion-spark"><Icon name="sparkles" size={23} /></span><p className="eyebrow">MAI MULT TIMP PENTRU TINE</p><h2>Din documente,<br />direct în planul tău.</h2><p>UniFlow identifică automat ce contează, ca tu să te concentrezi pe învățat.</p>
          <div className="ingestion-step"><span>01</span><div><strong>Încarcă</strong><small>Programa sau orarul tău</small></div></div>
          <div className="ingestion-step"><span>02</span><div><strong>Verifică</strong><small>Confirmă evenimentele găsite</small></div></div>
          <div className="ingestion-step"><span>03</span><div><strong>Organizează-te</strong><small>Adaugă-le în calendar</small></div></div>
        </aside>
      </div>
      {importState === "done" && <section className="card-surface extracted-card"><div className="extracted-heading"><div><p className="eyebrow">REZULTATUL ANALIZEI</p><h2>Am găsit 3 evenimente</h2></div><span className="pill pill-success"><Icon name="check" size={13} /> GATA DE REVIZUIT</span></div><div className="extracted-list"><article><span className="extracted-date">27<br /><small>MAR</small></span><div><strong>Predare proiect — Baze de date</strong><small>Deadline · 23:59</small></div><button aria-label="Editează evenimentul" className="quiet-icon" type="button"><Icon name="more" size={18} /></button></article><article><span className="extracted-date extracted-blue">03<br /><small>APR</small></span><div><strong>Test intermediar — Algoritmi</strong><small>Examen · 10:00</small></div><button aria-label="Editează evenimentul" className="quiet-icon" type="button"><Icon name="more" size={18} /></button></article><article><span className="extracted-date extracted-peach">10<br /><small>APR</small></span><div><strong>Referat — Etică profesională</strong><small>Deadline · 18:00</small></div><button aria-label="Editează evenimentul" className="quiet-icon" type="button"><Icon name="more" size={18} /></button></article></div><button className="button button-primary" onClick={() => setAdded(true)} type="button"><Icon name={added ? "check" : "calendar"} size={16} />{added ? "Evenimente adăugate în plan" : "Adaugă evenimentele în plan"}</button><p aria-live="polite" className="import-note">{added ? "Gata! Evenimentele au fost adăugate în planul tău de studiu." : "Poți verifica detaliile înainte să le adaugi."}</p></section>}
    </div>
  );
}
