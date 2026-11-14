import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import AppShell from "@/components/app-shell";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "UniFlow — Spațiul tău de studiu",
  description:
    "Orarul, materialele de curs, task-urile și timpii de așteptare din campus, într-un singur spațiu.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ro"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
