"use client";

import { useState, type FormEvent } from "react";
import {
  addSavedTasks,
  type TopicFlashcards,
  type SavedTask,
} from "@/lib/tasks";
import type { ScheduleEvent } from "@/lib/schedule-storage";
import type { StudentProfile } from "@/lib/profile";
import { generateStudyPlanTasks } from "@/lib/study-planner";
import { supabase } from "@/lib/supabase";

type StudyPlannerWidgetProps = {
  now: Date | null;
  schedule: ScheduleEvent[];
  studyLevel: Pick<StudentProfile, "institutionType" | "year">;
  tasks: SavedTask[];
};

function formatLocalDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedFlashcard(value: unknown): value is TopicFlashcards["flashcards"][number] {
  return (
    isRecord(value) &&
    typeof value.question === "string" &&
    value.question.trim().length > 0 &&
    value.question.length <= 300 &&
    typeof value.answer === "string" &&
    value.answer.trim().length > 0 &&
    value.answer.length <= 800
  );
}

function isTopicFlashcards(value: unknown): value is TopicFlashcards {
  return (
    isRecord(value) &&
    typeof value.topic === "string" &&
    value.topic.trim().length > 0 &&
    Array.isArray(value.flashcards) &&
    value.flashcards.length > 0 &&
    value.flashcards.length <= 4 &&
    value.flashcards.every(isSavedFlashcard)
  );
}

function isTopicFlashcardsResponse(value: unknown): value is { topics: TopicFlashcards[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.topics) &&
    value.topics.every(isTopicFlashcards)
  );
}

export default function StudyPlannerWidget({
  now,
  schedule,
  studyLevel,
  tasks,
}: StudyPlannerWidgetProps) {
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topics, setTopics] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [studyStart, setStudyStart] = useState("17:00");
  const [studyEnd, setStudyEnd] = useState("21:00");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const generatePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!now) {
      setError("Așteaptă sincronizarea orei locale și încearcă din nou.");
      return;
    }

    setGenerating(true);
    try {
      const plannedTasks = generateStudyPlanTasks(
        {
          subject,
          examDate,
          topics: topics.split(/\r?\n/),
          confidence,
          studyStart,
          studyEnd,
        },
        schedule,
        tasks,
        now,
      );
      if (!supabase) {
        throw new Error("Conexiunea la serviciu nu este configurată.");
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Autentifică-te din nou pentru a genera flashcardurile.");
      }

      const response = await fetch("/api/study-plan/flashcards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject,
          confidence,
          studyLevel,
          topics: topics.split(/\r?\n/),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Nu am putut genera flashcardurile.";
        throw new Error(message);
      }
      if (!isTopicFlashcardsResponse(payload)) {
        throw new Error("Răspunsul cu flashcarduri nu este valid. Încearcă din nou.");
      }

      const flashcardsByTopic = new Map(
        payload.topics.map((item) => [item.topic, item.flashcards]),
      );
      const tasksWithFlashcards = plannedTasks.map((task) => {
        const flashcards = flashcardsByTopic.get(task.topic);
        if (!flashcards?.length) {
          throw new Error(`Lipsesc flashcardurile pentru tema „${task.topic}”.`);
        }
        return { ...task, flashcards };
      });
      addSavedTasks(tasksWithFlashcards);
      setNotice(
        `Am adăugat ${plannedTasks.length} sesiuni cu flashcarduri în Task-uri și Orar.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Nu am putut genera planul de studiu.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="section-block study-planner-section" id="study-planner">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PLAN ADAPTIV</p>
          <h2>Pregătește-te pentru un examen</h2>
        </div>
        <span className="study-planner-duration">Sesiuni de 30 min</span>
      </div>
      <form className="card-surface study-planner-form" onSubmit={generatePlan}>
        <label className="form-field">
          <span>Materie sau curs</span>
          <input
            maxLength={80}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Ex. Baze de date"
            required
            value={subject}
          />
        </label>
        <label className="form-field">
          <span>Data examenului</span>
          <input
            min={now
              ? formatLocalDateInput(
                new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
              )
              : undefined}
            onChange={(event) => setExamDate(event.target.value)}
            required
            type="date"
            value={examDate}
          />
        </label>
        <label className="form-field">
          <span>Încredere în materie (1–5)</span>
          <select
            onChange={(event) => setConfidence(Number(event.target.value))}
            value={confidence}
          >
            <option value={1}>1 · Am nevoie de multă recapitulare</option>
            <option value={2}>2 · Mai am goluri</option>
            <option value={3}>3 · Nivel mediu</option>
            <option value={4}>4 · Mă simt pregătit</option>
            <option value={5}>5 · Vreau doar o recapitulare</option>
          </select>
        </label>
        <div className="study-planner-time-range">
          <label className="form-field">
            <span>Pot începe la</span>
            <input
              onChange={(event) => setStudyStart(event.target.value)}
              required
              type="time"
              value={studyStart}
            />
          </label>
          <label className="form-field">
            <span>Nu mai târziu de</span>
            <input
              onChange={(event) => setStudyEnd(event.target.value)}
              required
              type="time"
              value={studyEnd}
            />
          </label>
        </div>
        <label className="form-field study-planner-topics">
          <span>Teme de învățat · câte una pe rând</span>
          <textarea
            maxLength={1200}
            onChange={(event) => setTopics(event.target.value)}
            placeholder={"Modelul relațional\nInterogări SQL\nNormalizarea"}
            required
            rows={3}
            value={topics}
          />
        </label>
        {!schedule.length && (
          <p className="study-planner-note">
            Încarcă orarul pentru ca planul să evite cursurile. Fără orar, folosește doar intervalul zilnic ales.
          </p>
        )}
        <p className="study-planner-note study-planner-topics-note">
          Introdu temele manual. Planul evită orele de curs și intervalele din jurul task-urilor active.
          Gemini creează flashcarduri pentru fiecare temă; încrederea și anul/clasa din profil ajustează dificultatea.
        </p>
        {error && <p className="form-error study-planner-message" role="alert">{error}</p>}
        {notice && <p className="study-planner-success study-planner-message" role="status">{notice}</p>}
        <div className="study-planner-actions">
          <button className="button button-primary" disabled={!now} type="submit">
            Generează planul
          </button>
          <span>Planul se adaugă în Task-uri și apare în Orar.</span>
        </div>
      </form>
    </section>
  );
}
