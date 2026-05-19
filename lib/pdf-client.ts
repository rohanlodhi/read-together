"use client";

// IMPORTANT: do NOT import "react-pdf" or "pdfjs-dist" at the top of this
// module. They both reference DOMMatrix at module evaluation, which crashes
// during SSR. Everything below uses dynamic `await import(...)` so the
// pdfjs payload is only loaded in the browser.

export type PdfMeta = {
  totalPages: number;
  title: string | null;
  author: string | null;
};

async function loadPdfjs() {
  const { pdfjs } = await import("react-pdf");
  if (
    typeof window !== "undefined" &&
    !pdfjs.GlobalWorkerOptions.workerSrc
  ) {
    // Served from /public — kept in sync with installed pdfjs via the
    // `postinstall` script in package.json.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

export async function readPdfMeta(file: File | Blob): Promise<PdfMeta> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let title: string | null = null;
  let author: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (info) {
      title =
        typeof info.Title === "string" && info.Title.trim()
          ? info.Title.trim()
          : null;
      author =
        typeof info.Author === "string" && info.Author.trim()
          ? info.Author.trim()
          : null;
    }
  } catch {
    // metadata is optional
  }
  const totalPages = doc.numPages;
  await doc.destroy();
  return { totalPages, title, author };
}

/**
 * Render page 1 of the PDF to a PNG blob suitable for a cover thumbnail.
 */
export async function renderCover(
  file: File | Blob,
  targetWidth = 600,
): Promise<Blob> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context.");

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/png",
      0.85,
    ),
  );

  await doc.destroy();
  return blob;
}
