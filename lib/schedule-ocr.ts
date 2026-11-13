type ProgressCallback = (message: string) => void;

const maxPdfPages = 8;
const maxCanvasDimension = 2600;

export function isSupportedScheduleFile(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === "application/pdf"
    || fileName.endsWith(".pdf")
    || file.type.startsWith("image/")
    || /\.(png|jpe?g|webp)$/.test(fileName);
}

async function imageToCanvas(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxCanvasDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browserul nu a putut pregăti imaginea pentru recunoaștere.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export async function recognizeScheduleFile(file: File, onProgress: ProgressCallback) {
  const { createWorker } = await import("tesseract.js");
  onProgress("Se pregătește recunoașterea textului...");
  const worker = await createWorker("ron+eng", undefined, {
    logger: ({ status, progress }) => {
      if (status === "recognizing text") {
        onProgress(`Se citește orarul... ${Math.round(progress * 100)}%`);
      }
    },
  });

  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();

      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const pdfDocument = await loadingTask.promise;
      if (pdfDocument.numPages > maxPdfPages) {
        await loadingTask.destroy();
        throw new Error(`PDF-ul are ${pdfDocument.numPages} pagini. Încarcă un fișier de cel mult ${maxPdfPages} pagini.`);
      }

      const pages: string[] = [];
      try {
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          onProgress(`Se scanează pagina ${pageNumber} din ${pdfDocument.numPages}...`);
          const page = await pdfDocument.getPage(pageNumber);
          const originalViewport = page.getViewport({ scale: 2 });
          const scale = Math.min(
            2,
            maxCanvasDimension / Math.max(originalViewport.width, originalViewport.height),
          );
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({
            canvas,
            viewport,
          }).promise;

          const result = await worker.recognize(canvas);
          pages.push(result.data.text);
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      } finally {
        await loadingTask.destroy();
      }

      return pages.join("\n");
    }

    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      throw new Error("Alege un PDF scanat sau o imagine PNG, JPG ori WebP.");
    }

    const canvas = await imageToCanvas(file);
    const result = await worker.recognize(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}
