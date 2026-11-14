"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import ThemeToggle from "@/components/theme-toggle";
import { useDeviceNow } from "@/components/use-device-now";
import { formatWeekRange, formatWeekdayShort } from "@/lib/device-time";

const workflowSteps = [
  {
    id: "planner",
    label: "Planificator",
    time: "14:15",
    storyTitle: "Recuperezi exact ce-ai ratat.",
    description: "Reiei JOIN-urile SQL din laboratorul de marți.",
    note: "2 absențe rămase",
  },
  {
    id: "queueless",
    label: "QueueLess",
    time: "12:38",
    storyTitle: "Știi dacă merită să pleci acum.",
    description: "Ridici comanda după ce scade coada.",
    note: "Secretariatul e mai liber la 13:45",
  },
  {
    id: "skillswap",
    label: "SkillSwap",
    time: "16:20",
    storyTitle: "Un schimb mic poate debloca proiectul.",
    description: "Vlad te ajută cu Blender; tu, cu pointerii în C++.",
    note: "Mini-portofoliu verificat",
  },
] as const;

export default function Init() {
  const now = useDeviceNow();
  const [activeStep, setActiveStep] =
    useState<(typeof workflowSteps)[number]["id"]>("planner");
  const selectedStep =
    workflowSteps.find((step) => step.id === activeStep) ?? workflowSteps[0];

  return (
    <main className="landing-page">
      <div className="landing-shell">
        <header className="landing-header">
          <Link aria-label="UniFlow, pagina principală" className="landing-brand" href="/">
            <span>uni<span>flow</span></span>
          </Link>
          <nav aria-label="Navigare" className="landing-nav">
            <Link className="landing-login" href="/auth">Conectare</Link>
            <ThemeToggle />
            <Link className="button button-primary" href="/auth/signup">
              Creează cont <Icon name="arrow" size={16} />
            </Link>
          </nav>
        </header>

        <section aria-labelledby="landing-title" className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">PENTRU ZILELE REALE DE FACULTATE</p>
            <h1 id="landing-title">
              Mai puțin haos.
              <span>Mai mult timp.</span>
            </h1>
            <p className="landing-description">
              Orar, recapitulări și cozi, fără să cauți prin grupuri și PDF-uri.
            </p>
            <div className="landing-actions">
              <Link className="button button-primary landing-primary-cta" href="/auth/signup">
                Începe cu un cont <Icon name="arrow" size={17} />
              </Link>
              <Link className="button button-secondary" href="/auth">
                Am deja un cont
              </Link>
            </div>
            <p className="landing-privacy">Orarul și task-urile rămân ale tale.</p>
          </div>

          <section aria-labelledby="workflow-title" className="workflow-demo">
            <div className="workflow-card">
              <div className="workflow-heading">
                <div>
                  <p className="workflow-eyebrow">UNIFLOW · O ZI, TREI MOMENTE</p>
                  <h2 id="workflow-title">Din orar, direct la ce ai de făcut.</h2>
                </div>
                <span className="workflow-week">
                  {now ? formatWeekRange(now) : "Săptămâna aceasta"}
                </span>
              </div>

              <div className="workflow-tabbar">
                <div aria-label="Alege ce vrei să vezi" className="workflow-tabs" role="tablist">
                  {workflowSteps.map((step) => (
                    <button
                      aria-controls="workflow-panel"
                      aria-selected={activeStep === step.id}
                      className="workflow-tab"
                      id={`workflow-tab-${step.id}`}
                      key={step.id}
                      onClick={() => setActiveStep(step.id)}
                      role="tab"
                      type="button"
                    >
                      <span>{step.label}</span>
                      <small>{step.time}</small>
                    </button>
                  ))}
                </div>
                <span aria-hidden="true" className="workflow-hint">
                  Încearcă o filă
                  <svg fill="none" viewBox="0 0 58 34">
                    <path
                      d="M3 4c18 1 32 7 42 23m-9-5 9 6 2-10"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
              </div>

              <div
                aria-labelledby={`workflow-tab-${activeStep}`}
                className="workflow-panel"
                id="workflow-panel"
                key={activeStep}
                role="tabpanel"
                tabIndex={0}
              >
                <div className={`workflow-state workflow-state-${activeStep}`}>
                  {activeStep === "planner" && (
                    <>
                      <div className="workflow-state-heading">
                        <span className="workflow-kicker">PLANIFICATOR · AZI</span>
                        <span className="workflow-status workflow-status-amber">
                          2 absențe rămase
                        </span>
                      </div>
                      <div className="planner-entry">
                        <time className="planner-time" dateTime="14:15">
                          14:15–15:00
                        </time>
                        <div className="planner-entry-copy">
                          <strong>Recapitulează JOIN-urile SQL</strong>
                          <p>Ai ratat laboratorul de marți.</p>
                        </div>
                        <span className="planner-duration">45 min</span>
                      </div>
                      <div className="planner-foot">
                        <span>La Baze de date</span>
                        <span>O sesiune scurtă, pe subiect.</span>
                      </div>
                    </>
                  )}

                  {activeStep === "queueless" && (
                    <>
                      <div className="workflow-state-heading">
                        <span className="workflow-kicker">BON VIRTUAL · CAMPUS</span>
                        <span className="workflow-updated">
                          Actualizat acum 3 min
                        </span>
                      </div>
                      <div className="queue-ticket">
                        <div className="queue-ticket-heading">
                          <span className="queue-ticket-code">#B-19</span>
                          <span className="workflow-status workflow-status-green">
                            <span aria-hidden="true" />
                            În pregătire
                          </span>
                        </div>
                        <div className="queue-ticket-main">
                          <strong>Canteen Express</strong>
                          <span>Ridicare la tejgheaua 2</span>
                        </div>
                        <div className="queue-ticket-foot">
                          <strong>4 min</strong>
                          <span>Fără livrare</span>
                        </div>
                      </div>
                      <div className="queue-alert">
                        <span className="queue-alert-dot" aria-hidden="true" />
                        <div>
                          <strong>Secretariatul e aglomerat · 28 min</strong>
                          <span>Un interval mai bun: 13:45</span>
                        </div>
                      </div>
                    </>
                  )}

                  {activeStep === "skillswap" && (
                    <>
                      <div className="workflow-state-heading">
                        <span className="workflow-kicker">SKILLSWAP · SCHIMB DE SKILL-URI</span>
                        <span className="workflow-updated">În apropierea ta</span>
                      </div>
                      <div className="swap-person">
                        <span aria-hidden="true" className="swap-initials">VP</span>
                        <div className="swap-person-copy">
                          <strong>Vlad P.</strong>
                          <span>Anul III</span>
                        </div>
                        <span className="swap-verified">Mini-portofoliu verificat</span>
                      </div>
                      <div className="swap-trade">
                        <div>
                          <span>TE AJUTĂ CU</span>
                          <strong>Blender 3D</strong>
                        </div>
                        <span aria-hidden="true" className="swap-for">în schimb</span>
                        <div>
                          <span>CAUTĂ AJUTOR LA</span>
                          <strong>Pointeri în C++</strong>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <aside className="workflow-story">
                  <p className="workflow-story-time">
                    {selectedStep.time}
                    {now && <> · {formatWeekdayShort(now)}</>}
                  </p>
                  <h3>{selectedStep.storyTitle}</h3>
                  <p>{selectedStep.description}</p>
                  <div className="workflow-story-note">
                    <span aria-hidden="true" />
                    {selectedStep.note}
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </section>

        <section aria-label="Context de campus" className="landing-campus-band">
          <div className="landing-campus-content">
            <span className="landing-campus-label">PENTRU ZILE DE CAMPUS</span>
            <div aria-label="Context universitar" className="landing-campus-tags">
              <span>Timișoara</span>
              <span>UPT</span>
              <span>UVT</span>
              <span>Politehnica</span>
            </div>
            <span className="landing-campus-note">de la primul curs până la ultima coadă</span>
          </div>
        </section>

        <section aria-labelledby="manifesto-title" className="landing-manifesto">
          <p className="landing-manifesto-label" id="manifesto-title">
            DE CE UNIFLOW
          </p>
          <blockquote>
            Am făcut UniFlow ca să nu-ți pierzi pauza căutând prin grupuri.
          </blockquote>
        </section>

        <footer className="landing-footer">
          <Link aria-label="UniFlow, pagina principală" className="landing-brand" href="/">
            <span>uni<span>flow</span></span>
          </Link>
          <span className="landing-local-context">Timișoara · România</span>
          <Link className="landing-system-status" href="/queueless">
            <span aria-hidden="true" />
            QueueLess · actualizări live în aplicație
          </Link>
          <a
            className="landing-feedback"
            href="https://github.com/Surrender9174/UniFlow/issues/new"
            rel="noreferrer"
            target="_blank"
          >
            Trimite feedback
          </a>
        </footer>
      </div>
    </main>
  );
}
