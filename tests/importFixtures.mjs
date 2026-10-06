// Synthetic fixtures only. Uses already installed backend PDF/image utilities.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { spreadsheetTemplate } from "../src/services/importArchive.js";
import { TABLE_FIELDS } from "../src/services/questionImport.js";
const require = createRequire(path.join(process.env.MOCK_TEST_BACKEND_DIR, "package.json"));
const { PDFDocument, StandardFonts } = require("pdf-lib"), sharp = require("sharp");
const out = process.env.IMPORT_FIXTURE_DIR; await mkdir(out, { recursive: true });
const rows = Array.from({ length: 7 }, (_, i) => [`Synthetic import question ${i + 1}`, "First", "Second", "", "", "", "", "B", `Supplied explanation ${i + 1}. पढ़ाई जारी रखें.`, "Synthetic"]);
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
await writeFile(path.join(out, "questions.csv"), "\uFEFF" + [TABLE_FIELDS, ...rows].map((r) => r.map(quote).join(",")).join("\r\n"));
await writeFile(path.join(out, "invalid.csv"), 'question,option_a,option_b\n"Unclosed,First,Second');
await writeFile(path.join(out, "missing.csv"), "question,option_a,option_b,correct_answer,explanation\nMissing answer,First,Second,,");
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + [TABLE_FIELDS, ...rows].map((r, i) => `<row r="${i + 1}">` + r.map((v, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join("") + "</row>").join("") + "</sheetData></worksheet>";
const { boundedWorkbookArchive } = await import("../src/services/importArchive.js");
const files = boundedWorkbookArchive(spreadsheetTemplate());
const xlsx = async (name, xml) => writeFile(path.join(out, name), zipSync(Object.fromEntries(Object.entries({ ...files, "xl/worksheets/sheet1.xml": xml }).map(([n, v]) => [n, strToU8(v)]))));
await xlsx("questions.xlsx", sheet);
await xlsx("formula.xlsx", sheet.replace('<is><t>First</t></is>', '<f>WEBSERVICE("https://example.invalid")</f><v>1</v>'));
await xlsx("extra-columns.xlsx", sheet.replace('r="J2"', 'r="K2"'));
const digital = await PDFDocument.create(), font = await digital.embedFont(StandardFonts.Helvetica);
for (const lines of [["1. Digital question", "A. First", "B. Second", "Explanation: Supplied digital explanation."], ["2. Second page question", "A. One", "B. Two", "Explanation: Supplied second explanation.", "Answer key", "1.B 2.A"]]) {
  const p = digital.addPage([612, 792]); lines.forEach((line, i) => p.drawText(line, { x: 50, y: 735 - i * 35, size: 18, font }));
}
await writeFile(path.join(out, "digital.pdf"), await digital.save());
const many = await PDFDocument.create(); for (let i = 0; i < 21; i++) many.addPage([612, 792]); await writeFile(path.join(out, "too-many-pages.pdf"), await many.save());
await writeFile(path.join(out, "corrupt.pdf"), "%PDF-1.7\ncorrupt synthetic document");
const PDFKit = require("pdfkit"), locked = new PDFKit({ userPassword: "synthetic-only", ownerPassword: "synthetic-owner" }), lockedChunks = [];
await new Promise((resolve, reject) => { locked.on("data", (b) => lockedChunks.push(b)); locked.on("end", resolve); locked.on("error", reject); locked.text("Synthetic encrypted document"); locked.end(); });
await writeFile(path.join(out, "locked.pdf"), Buffer.concat(lockedChunks));
for (const [name, lines, family] of [["scan.pdf", ["1. Scanned question", "A. First", "B. Second", "Answer: B", "Explanation: Supplied scan explanation."], "DejaVu Sans"], ["hindi-scan.pdf", ["1. सही विकल्प?", "A. पहला", "B. दूसरा", "Answer: B", "Explanation: दी गई व्याख्या"], "Lohit Devanagari"]]) {
  const svg = `<svg width="1200" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${lines.map((line, i) => `<text x="60" y="${100 + i * 140}" font-size="48" font-family="${family}" fill="black">${escape(line)}</text>`).join("")}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer(), pdf = await PDFDocument.create(), img = await pdf.embedPng(png); pdf.addPage([600, 500]).drawImage(img, { x: 0, y: 0, width: 600, height: 500 }); await writeFile(path.join(out, name), await pdf.save());
}
console.log("Created synthetic CSV, XLSX, digital PDF, English/Hindi scanned PDF fixtures.");
