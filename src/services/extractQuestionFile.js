import { IMPORT_LIMITS, parseCsv } from "./questionImport.js";
import { workbookSheets, readWorkbookSheet } from "./importWorkbook.js";
const cancelled = () => new DOMException("Import cancelled. Your assessment is unchanged.", "AbortError");
const check = (signal) => { if (signal.aborted) throw cancelled(); };
function waitFor(promise, signal, milliseconds, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const aborted = () => done(reject, cancelled()), timer = setTimeout(() => done(reject, new Error(timeoutMessage)), milliseconds);
    const done = (fn, value) => { clearTimeout(timer); signal.removeEventListener("abort", aborted); fn(value); };
    signal.addEventListener("abort", aborted, { once: true }); if (signal.aborted) aborted();
    promise.then((v) => done(resolve, v), (e) => done(reject, e));
  });
}
async function workbook(bytes, signal) {
  const worker = new Worker(new URL("./importArchive.worker.js", import.meta.url), { type: "module" });
  try {
    const response = new Promise((resolve, reject) => { worker.onmessage = (e) => e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.files); worker.onerror = () => reject(new Error("Excel extraction failed. Export an unencrypted .xlsx or CSV file.")); worker.postMessage(bytes, [bytes]); });
    const files = await waitFor(response, signal, 15000, "Excel extraction took too long. Export a smaller workbook without images or extra sheets.");
    check(signal); const sheets = workbookSheets(files), table = readWorkbookSheet(files, sheets[0]);
    return { ...table, workbook: { files, sheets, selected: sheets[0].path } };
  } finally { worker.terminate(); }
}
function ocrSession(signal, progress) {
  const worker = new Worker(new URL("./importOcr.worker.js", import.meta.url), { type: "module" }), requests = new Map(); let next = 0;
  worker.onmessage = ({ data }) => {
    if (data.progress !== undefined) { if (!signal.aborted) progress(`OCR: ${data.progress}${data.fraction !== undefined ? ` (${Math.round(data.fraction * 100)}%)` : ""}`); return; }
    const pending = requests.get(data.id); if (!pending) return; requests.delete(data.id);
    if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data.value);
  };
  worker.onerror = () => { for (const p of requests.values()) p.reject(new Error("Local OCR failed to load. Retry or use CSV/Excel on this device.")); requests.clear(); };
  const job = (action, payload, timeoutMessage, transfer = []) => {
    check(signal); const id = ++next;
    const result = new Promise((resolve, reject) => { requests.set(id, { resolve, reject }); worker.postMessage({ id, action, ...payload }, transfer); });
    return waitFor(result, signal, 60000, timeoutMessage);
  };
  const close = () => { worker.terminate(); for (const p of requests.values()) p.reject(cancelled()); requests.clear(); signal.removeEventListener("abort", close); };
  signal.addEventListener("abort", close, { once: true });
  return { init: (language) => job("init", { language }, "OCR initialization took too long. Retry with English only or use CSV/Excel on this device."), recognize: async (canvas) => {
    const blob = await waitFor(new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Unable to prepare this scan for OCR.")), "image/png")), signal, 5000, "Preparing the scan took too long. Use a smaller image.");
    const image = await blob.arrayBuffer(); return job("recognize", { image }, "OCR took too long on this device. Use fewer scanned pages or import CSV/Excel.", [image]);
  }, close };
}
function pdfLines(items) {
  const ordered = items.filter((i) => typeof i.str === "string" && i.str.trim()).sort((a, b) => Math.abs(a.transform[5] - b.transform[5]) > 3 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
  const rows = []; let layout = false;
  for (const item of ordered) {
    const last = rows[rows.length - 1], y = item.transform[5], x = item.transform[4];
    if (!last || Math.abs(last.y - y) > 3) rows.push({ y, end: x + item.width, text: item.str });
    else { if (x - last.end > 100) layout = true; last.text += " " + item.str; last.end = x + item.width; }
  }
  return { text: rows.map((r) => r.text).join("\n"), layout };
}
async function pdf(bytes, { signal, language, forceOcr, progress }) {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs"), workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  check(signal); pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, maxImageSize: 16000000, canvasMaxAreaInBytes: 64 * 1024 * 1024, disableFontFace: true, useSystemFonts: true, standardFontDataUrl: "/import-assets/pdf/standard_fonts/", cMapUrl: "/import-assets/pdf/cmaps/", cMapPacked: true, wasmUrl: "/import-assets/pdf/wasm/" });
  loading.onPassword = () => loading.destroy();
  const abortPdf = () => { loading.destroy().catch(() => {}); }; signal.addEventListener("abort", abortPdf, { once: true });
  let document, ocr;
  try {
    document = await waitFor(loading.promise, signal, 20000, "PDF loading took too long. Export a smaller PDF.");
    if (document.numPages > IMPORT_LIMITS.pages) throw new Error("PDF has more than 20 pages. Split it before importing; no pages were discarded.");
    const pages = [], scan = [];
    for (let n = 1; n <= document.numPages; n++) {
      check(signal); progress(`Reading PDF page ${n}/${document.numPages}`);
      const page = await waitFor(document.getPage(n), signal, 20000, "A PDF page took too long to load. Export a simpler PDF.");
      const text = await waitFor(page.getTextContent(), signal, 20000, "PDF text extraction took too long. Export fewer pages.");
      if (text.items.length > 5000) throw new Error("A PDF page contains too many text objects. Export a simpler PDF.");
      const lines = pdfLines(text.items), ops = await waitFor(page.getOperatorList(), signal, 20000, "A PDF page is too complex to inspect.");
      if (ops.fnArray.length > 100000) throw new Error("A PDF page is too complex. Export a simpler PDF.");
      const images = ops.fnArray.filter((v) => [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject].includes(v)).length;
      const useOcr = forceOcr || lines.text.trim().length < 40;
      pages.push({ page: n, text: lines.text, flags: ["pdf_text", ...(lines.layout ? ["layout"] : []), ...(images && !useOcr ? ["diagram"] : [])] });
      if (useOcr) scan.push(n); page.cleanup();
    }
    if (scan.length > IMPORT_LIMITS.ocrPages) throw new Error(forceOcr ? "More than 6 pages need OCR with this setting. Turn off ‘Use OCR for every PDF page’ for a readable digital PDF, or split a scanned document into files of at most 6 pages. Nothing was applied." : "More than 6 pages need OCR. Split the scanned document into files of at most 6 pages.");
    if (scan.length) {
      progress(`Loading local ${language === "eng" ? "English" : "Hindi + English"} OCR assets…`);
      check(signal); ocr = ocrSession(signal, progress); await ocr.init(language);
      for (const n of scan) {
        check(signal); progress(`OCR page ${n}/${document.numPages}; ${scan.length} scanned pages total`);
        const page = await document.getPage(n), natural = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 1800 / Math.max(natural.width, natural.height), Math.sqrt(IMPORT_LIMITS.pixels / (natural.width * natural.height))), view = page.getViewport({ scale });
        const canvas = documentElement("canvas"); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        try {
          const render = page.render({ canvasContext: canvas.getContext("2d"), viewport: view });
          const stopRender = () => render.cancel(); signal.addEventListener("abort", stopRender, { once: true });
          try { await waitFor(render.promise, signal, 20000, "PDF page rendering took too long. Use a smaller scan."); } finally { signal.removeEventListener("abort", stopRender); }
          const result = await ocr.recognize(canvas);
          const confidence = Number(result.confidence), entry = pages[n - 1];
          entry.text = result.text; entry.confidence = Number.isFinite(confidence) ? confidence : 0; entry.flags = ["ocr", ...(entry.confidence < 75 ? ["low_confidence"] : []), ...(entry.flags.includes("layout") ? ["layout"] : [])];
        } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
      }
    }
    check(signal);
    if (pages.reduce((sum, p) => sum + p.text.length, 0) > IMPORT_LIMITS.text) throw new Error("Extracted PDF text exceeds the safe limit. Split the document.");
    return { kind: "pages", pages, warnings: ["PDF/OCR detection is best effort. Review every question against the original PDF; diagrams and complex columns may require manual transcription."] };
  } catch (error) {
    if (signal.aborted) throw cancelled();
    if (/password|Password|Worker was destroyed/.test(error.message || "")) throw new Error("Password-protected PDFs are unsupported. Export an unlocked copy locally, then retry.");
    if (/InvalidPDF|invalid pdf|Invalid PDF/i.test(error.name + " " + error.message)) throw new Error("PDF is corrupt or not a PDF document. Export it again.");
    throw error;
  } finally {
    ocr?.close(); signal.removeEventListener("abort", abortPdf); await loading.destroy().catch(() => {});
  }
}
// Keep PDFDocumentProxy's `document` binding separate from the browser DOM.
const documentElement = (tag) => globalThis.document.createElement(tag);
let queue = Promise.resolve();
export function extractQuestionFile(file, options) {
  const run = async () => {
    const { signal, progress, delimiter = "auto", language = "eng" } = options; check(signal);
    if (!["eng", "eng+hin"].includes(language)) throw new Error("Choose English or Hindi + English OCR.");
    const suffix = file.name.toLocaleLowerCase().split(".").pop();
    if (!["csv", "xlsx", "pdf"].includes(suffix)) throw new Error("Choose .pdf, .xlsx or UTF-8 .csv. Legacy .xls is unsupported; export it as .xlsx/CSV first.");
    if (!file.size || file.size > IMPORT_LIMITS.bytes || suffix === "csv" && file.size > IMPORT_LIMITS.csvBytes) throw new Error(suffix === "csv" ? "CSV must be nonempty and at most 2 MiB." : "PDF/Excel must be nonempty and at most 10 MiB.");
    progress("Reading selected file locally…");
    const bytes = await file.arrayBuffer(); check(signal);
    if (suffix === "csv") {
      let text; try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("CSV must be UTF-8 text. Export it again using UTF-8 encoding."); }
      return parseCsv(text, delimiter);
    }
    if (suffix === "xlsx") return workbook(bytes, signal);
    if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf("%PDF-") < 0) throw new Error("This file is not a valid PDF. Export it again.");
    return pdf(bytes, { ...options, language });
  };
  const pending = queue.then(run); queue = pending.then(() => undefined, () => undefined); return pending;
}
