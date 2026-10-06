import { boundedWorkbookArchive } from "./importArchive.js";
self.onmessage = (event) => {
  try { self.postMessage({ files: boundedWorkbookArchive(new Uint8Array(event.data)) }); }
  catch (error) { self.postMessage({ error: error.message || "Workbook extraction failed." }); }
};
