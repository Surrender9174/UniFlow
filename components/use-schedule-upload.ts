"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { parseScheduleText } from "@/lib/schedule-parser";
import { extractScheduleFile, isSupportedScheduleFile } from "@/lib/schedule-file-reader";
import { maxScheduleFileSize } from "@/lib/schedule-file-types";
import { saveSchedule, type ScheduleEvent } from "@/lib/schedule-storage";

export type ScheduleUploadStatus = "idle" | "processing" | "preview";

function getTimeValue(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function useScheduleUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<ScheduleUploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pendingSchedule, setPendingSchedule] = useState<ScheduleEvent[]>([]);

  const openFilePicker = () => {
    if (uploadStatus !== "processing") fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setUploadError("");
    setPendingSchedule([]);
    if (!file) return;

    if (file.size > maxScheduleFileSize) {
      setUploadError("Fișierul depășește limita de 15 MB.");
      input.value = "";
      return;
    }

    if (!isSupportedScheduleFile(file)) {
      setUploadError("Alege un PDF, o imagine, un fișier Excel, Word, CSV sau TXT.");
      input.value = "";
      return;
    }

    setUploadStatus("processing");
    setUploadMessage("Se pregătește recunoașterea textului...");
    try {
      const text = await extractScheduleFile(file, setUploadMessage);
      const parsedEvents = parseScheduleText(text);
      if (!parsedEvents.length) {
        throw new Error("Nu am putut identifica zile, ore și cursuri. Încearcă o scanare mai clară, cu zilele săptămânii vizibile.");
      }
      setPendingSchedule(parsedEvents);
      setUploadStatus("preview");
    } catch (error) {
      setUploadStatus("idle");
      setUploadError(
        error instanceof Error ? error.message : "Nu am putut procesa fișierul. Încearcă din nou.",
      );
    } finally {
      input.value = "";
    }
  };

  const updatePendingEvent = (
    eventId: string,
    field: keyof Omit<ScheduleEvent, "id">,
    value: string | number,
  ) => {
    setPendingSchedule((current) =>
      current.map((event) => event.id === eventId ? { ...event, [field]: value } : event),
    );
  };

  const savePendingSchedule = () => {
    if (pendingSchedule.some((event) =>
      !event.title.trim()
      || !event.start
      || !event.end
      || getTimeValue(event.end) <= getTimeValue(event.start)
    )) {
      setUploadError("Completează fiecare curs și verifică intervalul orar înainte de salvare.");
      return;
    }

    setUploadError("");
    saveSchedule(pendingSchedule);
    setPendingSchedule([]);
    setUploadStatus("idle");
  };

  const cancelSchedulePreview = () => {
    setPendingSchedule([]);
    setUploadError("");
    setUploadStatus("idle");
  };

  return {
    fileInputRef,
    uploadStatus,
    uploadMessage,
    uploadError,
    pendingSchedule,
    openFilePicker,
    handleFileChange,
    updatePendingEvent,
    savePendingSchedule,
    cancelSchedulePreview,
  };
}
