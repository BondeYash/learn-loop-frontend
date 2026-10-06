// This owned worker contains Tesseract's asynchronously created child worker.
// Terminating it stops initialization and recognition, including its child.
import { createWorker } from "tesseract.js";
let engine, request;
const respond = (id, value) => self.postMessage({ id, value });
const failure = (id, error) => self.postMessage({ id, error: String(error?.message || error || "Local OCR failed.") });
self.onmessage = async ({ data }) => {
  const { id, action, language, image } = data; request = id;
  try {
    if (action === "init") {
      if (engine || !["eng", "eng+hin"].includes(language)) throw new Error("Invalid OCR initialization.");
      const origin = self.location.origin;
      engine = await createWorker(language, 1, { workerPath: `${origin}/import-assets/ocr/worker.min.js`, workerBlobURL: false, corePath: `${origin}/import-assets/ocr`, langPath: `${origin}/import-assets/ocr`, cacheMethod: "none", logger: (m) => self.postMessage({ progress: m.status, fraction: m.progress }), errorHandler: (e) => failure(request, e) });
      await engine.setParameters({ tessedit_pageseg_mode: "3" }); respond(id, null);
    } else if (action === "recognize" && engine && image instanceof ArrayBuffer) {
      const { data: result } = await engine.recognize(new Uint8Array(image));
      if (result.text.length > 500000) throw new Error("OCR text exceeds the safe limit. Split the scan.");
      respond(id, { text: result.text, confidence: result.confidence });
    } else throw new Error("Invalid OCR operation.");
  } catch (error) { failure(id, error); }
};
