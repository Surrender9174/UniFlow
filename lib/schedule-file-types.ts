const supportedScheduleExtensions: readonly string[] = [
  "pdf", "png", "jpg", "jpeg", "webp", "xlsx", "xls", "xlsm",
  "docx", "doc", "csv", "txt",
];

export const scheduleFileAccept = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/csv",
  "text/plain",
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".xls", ".xlsm",
  ".docx", ".doc", ".csv", ".txt",
].join(",");

export const maxScheduleFileSize = 15 * 1024 * 1024;

export function getScheduleFileExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

export function isSupportedScheduleFile(file: Pick<File, "name">) {
  return supportedScheduleExtensions.includes(getScheduleFileExtension(file.name));
}
