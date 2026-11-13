import { supabase } from "@/lib/supabase";
import { recognizeScheduleFile } from "@/lib/schedule-ocr";
import { extractSpreadsheetText } from "@/lib/schedule-spreadsheet";

type ProgressCallback = (message: string) => void;

const maxExtractedTextLength = 500_000;

function getExtension(file: File) {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

async function extractLegacyWordFile(file: File, onProgress: ProgressCallback) {
  if (!supabase) throw new Error("Autentificarea nu este disponibilă.");
  onProgress("Fișierul Word .doc este trimis pe server pentru extragerea textului...");

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Nu am putut verifica sesiunea: ${error.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sesiunea a expirat. Conectează-te din nou și încearcă iar.");

  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/schedule/legacy-doc", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  const result = await response.json() as { error?: string; text?: string };
  if (!response.ok) throw new Error(result.error ?? "Nu am putut procesa fișierul Word .doc.");
  if (typeof result.text !== "string") throw new Error("Serverul nu a returnat textul extras din document.");
  return result.text;
}

export function isSupportedScheduleFile(file: File) {
  return [
    "pdf", "png", "jpg", "jpeg", "webp", "xlsx", "xls", "xlsm",
    "docx", "doc", "csv", "txt",
  ].includes(getExtension(file));
}

export async function extractScheduleFile(file: File, onProgress: ProgressCallback) {
  const extension = getExtension(file);
  let text: string;

  if (["pdf", "png", "jpg", "jpeg", "webp"].includes(extension)) {
    text = await recognizeScheduleFile(file, onProgress);
  } else if (["xlsx", "xls", "xlsm", "csv"].includes(extension)) {
    onProgress("Se citește foaia de calcul...");
    text = await extractSpreadsheetText(await file.arrayBuffer());
  } else if (extension === "docx") {
    onProgress("Se extrage textul din documentul Word...");
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (extension === "doc") {
    text = await extractLegacyWordFile(file, onProgress);
  } else if (extension === "txt") {
    onProgress("Se citește fișierul text...");
    text = (await file.text()).replace(/^\uFEFF/, "");
  } else {
    throw new Error("Formatul acestui fișier nu este acceptat.");
  }

  if (text.length > maxExtractedTextLength) {
    throw new Error("Documentul conține prea mult text pentru a fi procesat ca orar.");
  }
  return text;
}
