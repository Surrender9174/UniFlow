"use client";

import { createClient } from "@supabase/supabase-js";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

type LoginData = {
  email: string;
  password: string;
};

type SignupData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthMessage = {
  type: "error" | "success";
  text: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const initialLogin: LoginData = { email: "", password: "" };
const initialSignup: SignupData = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function getPasswordStrength(password: string) {
  if (!password) return { label: "", barClass: "", value: 0 };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { label: "Slabă", barClass: "weak", value: score };
  if (score <= 3) return { label: "Medie", barClass: "medium", value: score };
  return { label: "Puternică", barClass: "strong", value: score };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function updateField<T extends Record<string, string>>(
  setData: Dispatch<SetStateAction<T>>,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;
    setData((current) => ({ ...current, [name]: value }));
  };
}

function saveUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const email = user.email;
  if (!email) throw new Error("Contul nu conține o adresă de email.");

  const metadataName = user.user_metadata?.name;
  const userData = {
    name: typeof metadataName === "string" ? metadataName : email.split("@")[0],
    email,
    score: 0,
    items: 0,
    co2: 0,
    rewards: 0,
    avatar: "https://placehold.co/100x100/22C55E/FFFFFF?text=USER",
  };

  window.localStorage.setItem("currentUser", JSON.stringify(userData));
  window.localStorage.setItem("userEmail", email);
  window.localStorage.setItem("isLoggedIn", "true");
}

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginData, setLoginData] = useState(initialLogin);
  const [signupData, setSignupData] = useState(initialSignup);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

  const passwordStrength = useMemo(
    () => getPasswordStrength(signupData.password),
    [signupData.password],
  );

  const updateLoginField = updateField(setLoginData);
  const updateSignupField = updateField(setSignupData);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!supabase) {
        throw new Error(
          "Supabase nu este configurat. Completează variabilele din .env.local și repornește aplicația.",
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email.trim(),
        password: loginData.password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Autentificarea nu a returnat un utilizator.");

      saveUser(data.user);
      setMessage({ type: "success", text: "Conectare reușită." });
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "A apărut o eroare la autentificare."),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (signupData.password.length < 8) {
      setMessage({
        type: "error",
        text: "Parola trebuie să aibă cel puțin 8 caractere.",
      });
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setMessage({ type: "error", text: "Parolele nu coincid." });
      return;
    }

    if (passwordStrength.label === "Slabă") {
      setMessage({
        type: "error",
        text: "Parola este prea slabă. Folosește litere mari, cifre și caractere speciale.",
      });
      return;
    }

    setLoading(true);

    try {
      if (!supabase) {
        throw new Error(
          "Supabase nu este configurat. Completează variabilele din .env.local și repornește aplicația.",
        );
      }

      const { data, error } = await supabase.auth.signUp({
        email: signupData.email.trim(),
        password: signupData.password,
        options: { data: { name: signupData.name.trim() } },
      });

      if (error) throw error;
      if (!data.user) throw new Error("Înregistrarea nu a returnat un utilizator.");

      if (data.session) {
        saveUser(data.user);
        setMessage({ type: "success", text: "Cont creat și conectare reușită." });
      } else {
        setMessage({
          type: "success",
          text: "Cont creat. Verifică emailul pentru confirmarea înregistrării.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "A apărut o eroare la înregistrare."),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setMessage({
      type: "error",
      text: "Resetarea parolei nu este configurată încă pentru acest proiect.",
    });
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setMessage(null);
  };

  return (
      <main className="auth-container">
        <section className="auth-box" aria-labelledby="auth-title">
          <h1 id="auth-title">
            <span className="brand-symbol" aria-hidden="true">✦</span>
            Green Track
          </h1>

          {!supabase && (
            <div className="notification error setup-notice" role="alert">
              Supabase nu este configurat. Copiază .env.example în .env.local,
              completează cheia publică și repornește aplicația.
            </div>
          )}

          {message && (
            <div className={`notification ${message.type}`} role="alert">
              {message.text}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="input-icon">
                <label className="field-symbol" htmlFor="login-email" aria-label="Email">@</label>
                <input
                  autoComplete="email"
                  id="login-email"
                  name="email"
                  onChange={updateLoginField}
                  placeholder="Adresa ta de email"
                  required
                  type="email"
                  value={loginData.email}
                />
              </div>

              <div className="input-icon">
                <label className="field-symbol" htmlFor="login-password" aria-label="Parolă">●</label>
                <input
                  autoComplete="current-password"
                  id="login-password"
                  minLength={8}
                  name="password"
                  onChange={updateLoginField}
                  placeholder="Parola ta"
                  required
                  type={showLoginPassword ? "text" : "password"}
                  value={loginData.password}
                />
                <button
                  aria-label={showLoginPassword ? "Ascunde parola" : "Arată parola"}
                  aria-pressed={showLoginPassword}
                  className="toggle-eye"
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                  type="button"
                >
                  {showLoginPassword ? "Ascunde" : "Arată"}
                </button>
              </div>

              <div className="remember-forgot">
                <label>
                  <input name="remember" type="checkbox" />
                  Ține-mă minte
                </label>
              </div>

              <div className="forgot-password-wrapper">
                <button onClick={handleForgotPassword} type="button">
                  Ai uitat parola?
                </button>
              </div>

              <button disabled={loading} type="submit">
                {loading ? "Se conectează..." : "Conectare"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit}>
              <div className="input-icon">
                <label className="field-symbol" htmlFor="signup-name" aria-label="Nume">✦</label>
                <input
                  autoComplete="name"
                  id="signup-name"
                  name="name"
                  onChange={updateSignupField}
                  placeholder="Numele tău"
                  required
                  type="text"
                  value={signupData.name}
                />
              </div>

              <div className="input-icon">
                <label className="field-symbol" htmlFor="signup-email" aria-label="Email">@</label>
                <input
                  autoComplete="email"
                  id="signup-email"
                  name="email"
                  onChange={updateSignupField}
                  placeholder="Adresa ta de email"
                  required
                  type="email"
                  value={signupData.email}
                />
              </div>

              <div className="input-icon">
                <label className="field-symbol" htmlFor="signup-password" aria-label="Parolă">●</label>
                <input
                  autoComplete="new-password"
                  id="signup-password"
                  minLength={8}
                  name="password"
                  onChange={updateSignupField}
                  placeholder="Parola ta"
                  required
                  type={showSignupPassword ? "text" : "password"}
                  value={signupData.password}
                />
                <button
                  aria-label={showSignupPassword ? "Ascunde parola" : "Arată parola"}
                  aria-pressed={showSignupPassword}
                  className="toggle-eye"
                  onClick={() => setShowSignupPassword((visible) => !visible)}
                  type="button"
                >
                  {showSignupPassword ? "Ascunde" : "Arată"}
                </button>
              </div>

              {passwordStrength.label && (
                <>
                  <div
                    aria-label={`Puterea parolei: ${passwordStrength.label}`}
                    aria-valuemax={5}
                    aria-valuemin={0}
                    aria-valuenow={passwordStrength.value}
                    className="password-strength"
                    role="meter"
                  >
                    <div className={`password-strength-bar ${passwordStrength.barClass}`} />
                  </div>
                  <p className="password-strength-text">
                    Puterea parolei: {passwordStrength.label}
                  </p>
                </>
              )}

              <div className="input-icon">
                <label className="field-symbol" htmlFor="confirm-password" aria-label="Confirmă parola">●</label>
                <input
                  autoComplete="new-password"
                  id="confirm-password"
                  minLength={8}
                  name="confirmPassword"
                  onChange={updateSignupField}
                  placeholder="Confirmă parola"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={signupData.confirmPassword}
                />
                <button
                  aria-label={showConfirmPassword ? "Ascunde confirmarea parolei" : "Arată confirmarea parolei"}
                  aria-pressed={showConfirmPassword}
                  className="toggle-eye"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  type="button"
                >
                  {showConfirmPassword ? "Ascunde" : "Arată"}
                </button>
              </div>

              <button disabled={loading} type="submit">
                {loading ? "Se înregistrează..." : "Înregistrează-te"}
              </button>

              {passwordStrength.label === "Slabă" && (
                <div className="weak-password-warning" role="status">
                  Parola este prea slabă. Folosește litere mari, cifre și caractere speciale.
                </div>
              )}
            </form>
          )}

          <div className="form-footer">
            <p>
              {mode === "login" ? "Nu ai cont?" : "Ai deja cont?"}
              <button className="text-button" onClick={switchMode} type="button">
                {mode === "login" ? "Înregistrează-te" : "Conectează-te"}
              </button>
            </p>
          </div>
        </section>
      </main>
  );
}
