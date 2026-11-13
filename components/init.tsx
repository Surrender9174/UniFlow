"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import ThemeToggle from "@/components/theme-toggle";
import { useDeviceNow } from "@/components/use-device-now";
import { formatLocalTime, formatWeekRange, formatWeekdayShort } from "@/lib/device-time";

const features = [
  {
    icon: "calendar",
    title: "Orarul tău, clar",
    description: "Vezi cursurile și programul săptămânii dintr-o privire.",
  },
  {
    icon: "check",
    title: "Task-uri sub control",
    description: "Ține aproape termenele și urmărește ce ai de făcut.",
  },
  {
    icon: "book",
    title: "Resurse la îndemână",
    description: "Păstrează materialele de studiu într-un singur loc.",
  },
] as const;

export default function Init() {
  const now = useDeviceNow();

  return (
    <main className="landing-page">
      <div className="landing-shell">
        <header className="landing-header">
          <Link aria-label="UniFlow, pagina principală" className="landing-brand" href="/">
            <span className="brand-mark"><Icon name="sparkles" size={20} /></span>
            <span>uni<span>flow</span></span>
          </Link>
          <nav aria-label="Navigare" className="landing-nav">
            <Link className="landing-login" href="/auth">Conectare</Link>
            <ThemeToggle />
            <Link className="button button-primary" href="/auth/signup">
              Get started <Icon name="arrow" size={16} />
            </Link>
          </nav>
        </header>

        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-eyebrow">
              <span aria-hidden="true" />
              SPAȚIUL TĂU DE STUDIU
            </p>
            <h1>
              Un semestru mai simplu
              <span> începe aici.</span>
            </h1>
            <p className="landing-description">
              UniFlow adună orarul, task-urile și resursele tale academice într-un
              singur loc, ca să știi mereu ce urmează și să te concentrezi pe
              progresul tău.
            </p>
            <div className="landing-actions">
              <Link className="button button-primary landing-primary-cta" href="/auth/signup">
                Get started <Icon name="arrow" size={17} />
              </Link>
              <Link className="button button-secondary" href="/auth">
                Am deja un cont
              </Link>
            </div>
            <p className="landing-privacy">
              <Icon name="lock" size={14} />
              Datele tale rămân private și securizate.
            </p>
          </div>

          <div aria-label="Previzualizare UniFlow" className="landing-preview">
            <span aria-hidden="true" className="landing-orbit landing-orbit-one" />
            <span aria-hidden="true" className="landing-orbit landing-orbit-two" />
            <div className="landing-window">
              <div className="landing-window-heading">
                <div>
                  <p className="landing-window-eyebrow">SPAȚIUL TĂU DE STUDIU</p>
                  <h2>Săptămâna ta</h2>
                </div>
                <span className="landing-week">{now ? formatWeekRange(now) : "Se sincronizează"}</span>
              </div>
              <div className="landing-today">
                <div className="landing-date">
                  <span>{now ? formatWeekdayShort(now) : "···"}</span>
                  <strong>{now?.getDate() ?? "--"}</strong>
                  <small>{now ? formatLocalTime(now) : "--:--"}</small>
                </div>
                <div className="landing-class">
                  <span>CURS EXEMPLU · 09:00</span>
                  <strong>Proiectare software</strong>
                  <small>Amfiteatrul A · Corp B</small>
                </div>
              </div>
              <div className="landing-tasks">
                <div className="landing-tasks-heading">
                  <span><Icon name="check" size={16} /> Task-uri pentru azi</span>
                  <strong>3 <small>/ 5 finalizate</small></strong>
                </div>
                <div aria-label="3 din 5 task-uri finalizate" className="landing-progress">
                  <span />
                </div>
              </div>
              <div className="landing-resource">
                <span className="landing-resource-icon"><Icon name="book" size={17} /></span>
                <span><strong>Materiale de curs</strong><small>Organizate într-un singur loc</small></span>
                <Icon name="chevron" size={16} />
              </div>
            </div>
            <div className="landing-floating-note">
              <span><Icon name="sparkles" size={16} /></span>
              Mai multă claritate, zi de zi
            </div>
          </div>
        </section>

        <section aria-label="Ce poți face cu UniFlow" className="landing-features">
          {features.map((feature) => (
            <article className="landing-feature" key={feature.title}>
              <span className="landing-feature-icon"><Icon name={feature.icon} size={19} /></span>
              <div>
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
