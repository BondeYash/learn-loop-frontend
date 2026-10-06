import { Unzip, UnzipInflate, zipSync, strToU8 } from "fflate";
import { IMPORT_LIMITS, TABLE_FIELDS } from "./questionImport.js";
export function boundedWorkbookArchive(bytes) {
  if (bytes.length > IMPORT_LIMITS.bytes) throw new Error("Excel files must be at most 10 MiB.");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4) throw new Error("Use an unencrypted .xlsx workbook. Legacy .xls and password-protected Excel files are unsupported; export to .xlsx or UTF-8 CSV.");
  let end = false;
  for (let i = Math.max(0, bytes.length - 65557); i + 22 <= bytes.length; i++) if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 5 && bytes[i + 3] === 6) end = true;
  if (!end) throw new Error("The workbook ZIP is incomplete or corrupt. Export the file again.");
  const files = new Map(), names = new Set(); let total = 0, entries = 0, unfinished = 0;
  const zip = new Unzip((file) => {
    if (++entries > IMPORT_LIMITS.entries || names.has(file.name)) throw new Error("Workbook has too many or duplicate ZIP entries. Export a simpler workbook.");
    names.add(file.name);
    if (/vba|macros/i.test(file.name)) throw new Error("Macro-enabled workbooks are unsupported. Export question values to .xlsx or CSV.");
    if (file.name.startsWith("/") || file.name.split("/").includes("..") || file.name.includes("\\")) throw new Error("Workbook contains unsafe archive paths.");
    if (file.originalSize > IMPORT_LIMITS.expanded) throw new Error("Workbook expands beyond the 16 MiB limit. Export a smaller workbook.");
    const needed = /^(?:\[Content_Types\]\.xml|xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/[^/]+\.xml)$/.test(file.name);
    const chunks = []; let size = 0; unfinished++;
    file.ondata = (error, chunk, final) => {
      if (error) throw new Error("Workbook is corrupt or uses unsupported ZIP compression. Export it again.");
      total += chunk.length; size += chunk.length;
      if (total > IMPORT_LIMITS.expanded || needed && size > 2 * 1024 * 1024) throw new Error("Workbook expands beyond safe XML/ZIP limits. Export fewer rows without extra objects.");
      if (needed) chunks.push(chunk);
      if (final) {
        unfinished--;
        if (needed) { const merged = new Uint8Array(size); let offset = 0; for (const c of chunks) { merged.set(c, offset); offset += c.length; } files.set(file.name, new TextDecoder("utf-8", { fatal: true }).decode(merged)); }
      }
    };
    // Decompress even ignored parts to enforce the actual total expansion cap.
    file.start();
  });
  zip.register(UnzipInflate);
  // A small compressed input chunk bounds each inflation callback allocation.
  for (let i = 0; i < bytes.length; i += 2048) zip.push(bytes.subarray(i, i + 2048), i + 2048 >= bytes.length);
  if (unfinished || !files.has("xl/workbook.xml") || !files.has("xl/_rels/workbook.xml.rels")) throw new Error("Workbook is incomplete. Export an unencrypted .xlsx file again.");
  return Object.fromEntries(files);
}
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function spreadsheetTemplate() {
  const cells = TABLE_FIELDS.map((h, i) => `<c r="${String.fromCharCode(65 + i)}1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`).join("");
  return zipSync(Object.fromEntries(Object.entries({
    "[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Questions" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`,
  }).map(([name, xml]) => [name, strToU8(xml)])), { level: 6 });
}
