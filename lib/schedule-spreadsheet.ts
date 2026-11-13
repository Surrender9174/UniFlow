import type { WorkSheet } from "@e965/xlsx";

const maxWorksheetCells = 100_000;
const weekdays = [
  { index: 1, names: ["luni", "monday", "mon"] },
  { index: 2, names: ["marti", "tuesday", "tue"] },
  { index: 3, names: ["miercuri", "wednesday", "wed"] },
  { index: 4, names: ["joi", "thursday", "thu"] },
  { index: 5, names: ["vineri", "friday", "fri"] },
  { index: 6, names: ["sambata", "saturday", "sat"] },
  { index: 0, names: ["duminica", "sunday", "sun"] },
];
const timePattern = /\b(?:[01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(?:-|–|—|pana la|la)\s*(?:[01]?\d|2[0-3])[:.]([0-5]\d))?\b/i;
const singleTimePattern = /^(?:[01]?\d|2[0-3])[:.][0-5]\d$/i;

function normalizeCell(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getWeekday(value: string) {
  const normalized = normalizeCell(value);
  return weekdays.find((weekday) => weekday.names.includes(normalized))?.index;
}

function getCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return String(value).trim();
}

function getColumnIndex(row: string[], names: string[]) {
  return row.findIndex((cell) => names.includes(normalizeCell(cell)));
}

function findTableRows(rows: string[][]) {
  const dayNames = ["zi", "ziua", "day", "weekday"];
  const startNames = ["ora", "ora inceput", "start", "start time", "time", "interval"];
  const titleNames = ["curs", "disciplina", "materie", "course", "subject", "activitate", "denumire"];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const day = getColumnIndex(row, dayNames);
    const start = getColumnIndex(row, startNames);
    const title = getColumnIndex(row, titleNames);
    if (day < 0 || start < 0 || title < 0) continue;

    const end = getColumnIndex(row, ["sfarsit", "ora sfarsit", "end", "end time", "pana la"]);
    const type = getColumnIndex(row, ["tip", "type", "activitate tip"]);
    const room = getColumnIndex(row, ["sala", "room", "locatie", "location"]);
    const lines = rows.slice(index + 1).flatMap((dataRow) => {
      const weekday = dataRow[day] ?? "";
      const startTime = dataRow[start] ?? "";
      const course = dataRow[title] ?? "";
      if (getWeekday(weekday) === undefined || !startTime || !course) return [];

      const endTime = end >= 0 ? dataRow[end] ?? "" : "";
      const activityType = type >= 0 ? dataRow[type] ?? "" : "";
      const roomName = room >= 0 ? dataRow[room] ?? "" : "";
      const roomText = roomName && !/^sala\b/i.test(roomName) ? `Sala ${roomName}` : roomName;
      return [[weekday, `${startTime}${endTime ? `-${endTime}` : ""}`, activityType, course, roomText]
        .filter(Boolean)
        .join(" ")];
    });

    if (lines.length) return [...rows.slice(0, index).map((priorRow) => priorRow.filter(Boolean).join(" ")), ...lines];
  }
  return null;
}

function findGridRows(rows: string[][]) {
  for (let index = 0; index < rows.length; index += 1) {
    const dayColumns = rows[index]
      .map((cell, column) => ({ column, weekday: getWeekday(cell), name: cell }))
      .filter((entry): entry is { column: number; weekday: number; name: string } => entry.weekday !== undefined);
    if (dayColumns.length < 2) continue;

    const lines = rows.slice(index + 1).flatMap((row) => {
      const timeCells = row
        .map((cell, column) => ({ cell, column }))
        .filter((entry) => !dayColumns.some((day) => day.column === entry.column) && timePattern.test(entry.cell));
      if (!timeCells.length) return [];

      const timeText = timeCells.length > 1
        && singleTimePattern.test(timeCells[0].cell)
        && singleTimePattern.test(timeCells[1].cell)
        ? `${timeCells[0].cell}-${timeCells[1].cell}`
        : timeCells[0].cell;
      const timeColumns = timeCells.slice(0, timeText.includes("-") && timeCells.length > 1 ? 2 : 1)
        .map((entry) => entry.column);
      const extraCells = row.filter((_, column) =>
        !dayColumns.some((day) => day.column === column) && !timeColumns.includes(column),
      );

      return dayColumns.flatMap((day) => {
        const course = row[day.column]?.trim();
        if (!course) return [];
        return [[day.name, timeText, ...extraCells.filter(Boolean), course].filter(Boolean).join(" ")];
      });
    });

    if (lines.length) {
      const preamble = rows.slice(0, index).map((row) => row.filter(Boolean).join(" ")).filter(Boolean);
      return [...preamble, ...lines];
    }
  }
  return null;
}

function worksheetRows(xlsx: typeof import("@e965/xlsx"), sheet: WorkSheet) {
  const range = sheet["!ref"];
  if (range) {
    const { e, s } = xlsx.utils.decode_range(range);
    const cellCount = (e.r - s.r + 1) * (e.c - s.c + 1);
    if (cellCount > maxWorksheetCells) {
      throw new Error("Foaia de calcul conține prea multe celule pentru a fi procesată ca orar.");
    }
  }

  return xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
    dateNF: "hh:mm",
  }).map((row) => row.map(getCellText));
}

export async function extractSpreadsheetText(data: ArrayBuffer) {
  const xlsx = await import("@e965/xlsx");
  const workbook = xlsx.read(data, { type: "array", cellDates: false });
  if (workbook.SheetNames.length > 20) {
    throw new Error("Fișierul are prea multe foi de calcul pentru a fi procesat ca orar.");
  }

  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const rows = worksheetRows(xlsx, workbook.Sheets[sheetName]);
    return (findTableRows(rows) ?? findGridRows(rows) ?? rows.map((row) => row.filter(Boolean).join(" ")))
      .filter(Boolean)
      .join("\n");
  });
  return sheetTexts.filter(Boolean).join("\n");
}
