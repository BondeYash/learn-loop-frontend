import { mkdir, copyFile, readdir, writeFile, cp } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "public/import-assets");
await mkdir(path.join(target, "ocr"), { recursive: true });
await copyFile(path.join(root, "node_modules/tesseract.js/dist/worker.min.js"), path.join(target, "ocr/worker.min.js"));
await copyFile(path.join(root, "node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt"), path.join(target, "ocr/worker.min.js.LICENSE.txt"));
for (const file of await readdir(path.join(root, "node_modules/tesseract.js-core"))) if (/\.wasm(?:\.js)?$/.test(file)) await copyFile(path.join(root, "node_modules/tesseract.js-core", file), path.join(target, "ocr", file));
await copyFile(path.join(root, "node_modules/tesseract.js/LICENSE.md"), path.join(target, "ocr/TESSERACT-LICENSE.md"));
await copyFile(path.join(root, "node_modules/tesseract.js-core/LICENSE"), path.join(target, "ocr/CORE-LICENSE"));
await copyFile(path.join(root, "scripts/licenses/tessdata-LICENSE.txt"), path.join(target, "ocr/TESSDATA-LICENSE.txt"));
await copyFile(path.join(root, "node_modules/fflate/LICENSE"), path.join(target, "FFLATE-LICENSE.txt"));
for (const language of ["eng", "hin"]) {
  await copyFile(path.join(root, `node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`), path.join(target, "ocr", `${language}.traineddata.gz`));
  await copyFile(path.join(root, `node_modules/@tesseract.js-data/${language}/package.json`), path.join(target, "ocr", `${language}-package.json`));
}
for (const directory of ["standard_fonts", "cmaps", "wasm"]) await cp(path.join(root, "node_modules/pdfjs-dist", directory), path.join(target, "pdf", directory), { recursive: true });
await copyFile(path.join(root, "node_modules/pdfjs-dist/LICENSE"), path.join(target, "pdf/LICENSE"));
await writeFile(path.join(target, "NOTICE.txt"), "PDF.js 6.4.299 (https://github.com/mozilla/pdf.js), Tesseract.js/core 7.0.0 (https://github.com/naptha/tesseract.js): Apache-2.0. English/Hindi @tesseract.js-data 1.0.0 packages declare MIT in registry metadata; their 4.0.0_best_int models originate from Apache-2.0 naptha/tessdata (https://github.com/naptha/tessdata). Upstream tessdata LICENSE is retained as TESSDATA-LICENSE.txt. fflate 0.8.3 (https://github.com/101arrowz/fflate): MIT. Versions/integrities are pinned in package-lock.json. OCR assets are served from this app; documents are processed locally.\n");
console.log("Prepared same-origin PDF/OCR assets.");
