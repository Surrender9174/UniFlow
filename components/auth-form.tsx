"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { syncAuthenticatedProfile } from "@/lib/auth-profile";
import { supabase } from "@/lib/supabase";

type AuthMessage = {
  type: "error" | "success";
  text: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Slabă", tone: "weak", value: score };
  if (score <= 3) return { label: "Medie", tone: "medium", value: score };
  return { label: "Puternică", tone: "strong", value: score };
}

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [institutionType, setInstitutionType] = useState<"university" | "high-school">("university");
  const [university, setUniversity] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [schedule, setSchedule] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setMessage({
          type: "error",
          text: getErrorMessage(error, "Nu am putut verifica sesiunea."),
        });
      } else if (data.session?.user) {
        syncAuthenticatedProfile(data.session.user);
        router.replace("/");
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage({
        type: "error",
        text: "Supabase nu este configurat. Completează variabilele din .env.local și repornește aplicația.",
      });
      return;
    }

    if (mode === "signup") {
      if (
        [name, university, program, year, semester, schedule].some(
          (value) => !value.trim(),
        )
      ) {
        setMessage({
          type: "error",
          text: "Completează toate informațiile despre studiile tale.",
        });
        return;
      }
      if (password.length < 8) {
        setMessage({
          type: "error",
          text: "Parola trebuie să aibă cel puțin 8 caractere.",
        });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: "error", text: "Parolele nu coincid." });
        return;
      }
      if (strength.label === "Slabă") {
        setMessage({
          type: "error",
          text: "Parola este prea slabă. Folosește litere mari, cifre și caractere speciale.",
        });
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Autentificarea nu a returnat un utilizator.");

        syncAuthenticatedProfile(data.user);
        router.replace("/");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            institutionType,
            university: university.trim(),
            program: program.trim(),
            year,
            semester,
            schedule: schedule.trim(),
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Înregistrarea nu a returnat un utilizator.");

      if (data.session) {
        syncAuthenticatedProfile(data.user);
        router.replace("/");
      } else {
        setMessage({
          type: "success",
          text: "Cont creat. Verifică emailul pentru confirmarea înregistrării.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(
          error,
          mode === "login"
            ? "A apărut o eroare la autentificare."
            : "A apărut o eroare la înregistrare.",
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setMessage(null);
  };

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <Link className="auth-brand" href="/">
            <span className="brand-mark"><Icon name="sparkles" size={20} /></span>
            <span>uni<span>flow</span></span>
          </Link>
          <div className="auth-intro-copy">
            <p className="eyebrow">SPAȚIUL TĂU DE STUDIU</p>
            <h1>Un semestru mai simplu începe aici.</h1>
            <p>
              Orarul, task-urile și resursele tale academice, într-un singur
              loc.
            </p>
          </div>
          <div className="auth-intro-note">
            <Icon name="sparkles" size={17} />
            <span>Organizează-ți ideile. Fă loc progresului.</span>
          </div>
          <span aria-hidden="true" className="auth-decoration auth-decoration-one" />
          <span aria-hidden="true" className="auth-decoration auth-decoration-two" />
        </section>

        <section aria-labelledby="auth-title" className="auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">{mode === "login" ? "BINE AI REVENIT" : "ÎNCEPE CU UN CONT NOU"}</p>
            <h2 id="auth-title">
              {mode === "login" ? "Conectează-te" : "Creează-ți cont"}
            </h2>
            <p>
              {mode === "login"
                ? "Continuă de unde ai rămas."
                : "Alătură-te și organizează-ți semestrul."}
            </p>
          </div>

          {!supabase && (
            <div className="auth-message error" role="alert">
              Supabase nu este configurat. Completează variabilele din
              .env.local și repornește aplicația.
            </div>
          )}
          {message && (
            <div className={`auth-message ${message.type}`} role="alert">
              {message.text}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <label className="auth-field">
                  <span>Nume complet</span>
                  <input
                    autoComplete="name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Numele tău"
                    required
                    value={name}
                  />
                </label>
                <div className="auth-fields-grid">
                  <label className="auth-field">
                    <span>Tipul instituției</span>
                    <select
                      onChange={(event) => {
                        const type = event.target.value === "high-school" ? "high-school" : "university";
                        setInstitutionType(type);
                        setYear("");
                      }}
                      required
                      value={institutionType}
                    >
                      <option value="university">Universitate</option>
                      <option value="high-school">Liceu</option>
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>{institutionType === "university" ? "Universitate" : "Liceu"}</span>
                    <input
                      autoComplete="organization"
                      onChange={(event) => setUniversity(event.target.value)}
                      placeholder={institutionType === "university" ? "Numele universității" : "Numele liceului"}
                      required
                      value={university}
                    />
                  </label>
                  <label className="auth-field">
                    <span>{institutionType === "university" ? "Specializare" : "Profil"}</span>
                    <input
                      onChange={(event) => setProgram(event.target.value)}
                      placeholder={institutionType === "university" ? "ex. Informatică" : "ex. Real"}
                      required
                      value={program}
                    />
                  </label>
                  <label className="auth-field">
                    <span>{institutionType === "university" ? "An de studiu" : "Clasa"}</span>
                    <select onChange={(event) => setYear(event.target.value)} required value={year}>
                      <option disabled value="">Alege anul</option>
                      {(institutionType === "university"
                        ? ["Anul I", "Anul II", "Anul III", "Anul IV", "Master I", "Master II", "Doctorat"]
                        : ["Clasa a IX-a", "Clasa a X-a", "Clasa a XI-a", "Clasa a XII-a"]
                      ).map((studyYear) => (
                        <option key={studyYear} value={studyYear}>{studyYear}</option>
                      ))}
                    </select>
                  </label>
                  <label className="auth-field">
                    <span>Semestru</span>
                    <select onChange={(event) => setSemester(event.target.value)} required value={semester}>
                      <option disabled value="">Alege semestrul</option>
                      <option value="Semestrul I">Semestrul I</option>
                      <option value="Semestrul II">Semestrul II</option>
                    </select>
                  </label>
                  <label className="auth-field auth-schedule-field">
                    <span>Orar</span>
                    <textarea
                      onChange={(event) => setSchedule(event.target.value)}
                      placeholder="Ex.: Luni, 08:00 — Matematică; 10:00 — Fizică"
                      required
                      rows={3}
                      value={schedule}
                    />
                  </label>
                </div>
              </>
            )}
            <label className="auth-field">
              <span>Adresă de email</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nume@universitate.ro"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="auth-field">
              <span>Parolă</span>
              <span className="auth-password-wrap">
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Introdu parola"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ascunde parola" : "Arată parola"}
                  aria-pressed={showPassword}
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? "Ascunde" : "Arată"}
                </button>
              </span>
            </label>

            {mode === "signup" && password && (
              <>
                <div
                  aria-label={`Puterea parolei: ${strength.label}`}
                  aria-valuemax={5}
                  aria-valuemin={0}
                  aria-valuenow={strength.value}
                  className={`auth-strength ${strength.tone}`}
                  role="meter"
                >
                  <span />
                </div>
                <p className="auth-strength-label">Puterea parolei: {strength.label}</p>
                <label className="auth-field">
                  <span>Confirmă parola</span>
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Introdu parola din nou"
                    required
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                  />
                </label>
              </>
            )}

            <button className="button button-primary auth-submit" disabled={loading} type="submit">
              {loading
                ? mode === "login" ? "Se conectează..." : "Se creează contul..."
                : mode === "login" ? "Conectează-te" : "Creează contul"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "Nu ai încă un cont?" : "Ai deja un cont?"}
            <button onClick={switchMode} type="button">
              {mode === "login" ? "Înregistrează-te" : "Conectează-te"}
            </button>
          </p>
          <p className="auth-privacy">
            <Icon name="lock" size={14} /> Datele tale rămân private și securizate.
          </p>
        </section>
      </div>
    </main>
  );
}
