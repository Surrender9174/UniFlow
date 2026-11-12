import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const layoutStyles = `
  :root {
    --primary-color: #00e676;
    --primary-dark: #00c853;
    --dark-color: #1c1c1c;
    --darker-color: #121212;
    --error-color: #e74c3c;
    --transition: all .2s ease;
  }
  * { box-sizing: border-box; }
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(135deg, var(--dark-color), var(--darker-color));
    color: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  .auth-box {
    position: relative;
    width: 100%;
    max-width: 420px;
    overflow: hidden;
    padding: 40px 35px;
    border-radius: 20px;
    background: #1c1c1c;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .5);
    animation: fadeIn .5s ease both;
  }
  .auth-box::before {
    position: absolute;
    z-index: 0;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(to bottom right, rgba(0, 230, 118, .1), transparent 50%);
    content: "";
    pointer-events: none;
    transform: rotate(30deg);
  }
  .auth-box > * { position: relative; }
  .auth-box h1 {
    margin: 0 0 30px;
    color: var(--primary-color);
    font-size: 2.2rem;
    font-weight: 700;
    text-align: center;
    text-shadow: 0 2px 4px rgba(0, 0, 0, .2);
  }
  .brand-symbol { margin-right: 8px; }
  .input-icon { position: relative; width: 100%; margin-bottom: 18px; }
  .field-symbol {
    position: absolute;
    top: 50%;
    left: 16px;
    color: var(--primary-color);
    font-size: 1.1rem;
    transform: translateY(-50%);
  }
  .input-icon input {
    width: 100%;
    padding: 14px 90px 14px 45px;
    border: 2px solid #2e2e2e;
    border-radius: 10px;
    outline: none;
    background: #2e2e2e;
    color: #fff;
    font-size: 1rem;
    transition: var(--transition);
  }
  .input-icon input:focus {
    border-color: var(--primary-color);
    background: #333;
    box-shadow: 0 0 0 3px rgba(0, 230, 118, .18);
  }
  .input-icon input::placeholder { color: #aaa; }
  .toggle-eye {
    position: absolute;
    top: 50%;
    right: 12px;
    width: auto !important;
    padding: 6px 8px !important;
    border: 0 !important;
    background: transparent !important;
    color: var(--primary-color) !important;
    font-size: .78rem !important;
    transform: translateY(-50%);
  }
  .remember-forgot {
    display: flex;
    align-items: center;
    margin: 12px 0 18px;
    color: #ddd;
    font-size: .95rem;
  }
  .remember-forgot label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .remember-forgot input { accent-color: var(--primary-color); }
  .notification {
    margin-bottom: 18px;
    padding: 12px 14px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: .92rem;
    line-height: 1.45;
  }
  .notification.error {
    border-color: rgba(231, 76, 60, .4);
    background: rgba(231, 76, 60, .15);
    color: #ff9a9a;
  }
  .notification.success {
    border-color: rgba(46, 204, 113, .4);
    background: rgba(46, 204, 113, .12);
    color: #7ef0ad;
  }
  .password-strength {
    height: 8px;
    margin: -2px 0 9px;
    overflow: hidden;
    border-radius: 999px;
    background: #2c2c2c;
  }
  .password-strength-bar { height: 100%; transition: var(--transition); }
  .password-strength-bar.weak { width: 33%; background: #e74c3c; }
  .password-strength-bar.medium { width: 66%; background: #f39c12; }
  .password-strength-bar.strong { width: 100%; background: var(--primary-color); }
  .password-strength-text { margin: 0 0 12px; color: #ccc; font-size: .8rem; }
  .weak-password-warning {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(231, 76, 60, .35);
    border-radius: 10px;
    background: rgba(231, 76, 60, .12);
    color: #ff9a9a;
    font-size: .82rem;
  }
  .auth-box button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    border: 0;
    border-radius: 10px;
    background: var(--primary-color);
    color: #000;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);
  }
  .auth-box button:hover:not(:disabled) {
    background: var(--primary-dark);
    box-shadow: 0 5px 15px rgba(0, 230, 118, .3);
    transform: translateY(-1px);
  }
  .auth-box button:disabled { cursor: not-allowed; opacity: .65; }
  .auth-box .text-button {
    width: auto;
    padding: 7px 12px;
    border: 1px solid rgba(0, 230, 118, .5);
    background: transparent;
    color: var(--primary-color);
    font-size: .9rem;
  }
  .auth-box .text-button:hover:not(:disabled) {
    background: rgba(0, 230, 118, .1);
    box-shadow: none;
    transform: none;
  }
  .form-footer { margin-top: 22px; color: #ddd; text-align: center; }
  .form-footer p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0;
  }
  .forgot-password-wrapper { margin: -4px 0 16px; text-align: right; }
  .forgot-password-wrapper button {
    display: inline;
    width: auto;
    padding: 0;
    background: transparent;
    color: #bdbdbd;
    font-size: .85rem;
    font-weight: 400;
    text-decoration: underline;
  }
  .setup-notice { margin-bottom: 18px; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 480px) {
    .auth-box { padding: 30px 22px; }
    .auth-box h1 { font-size: 1.9rem; }
  }
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Green Track",
  description: "Conectează-te sau creează un cont Green Track.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style>{layoutStyles}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
