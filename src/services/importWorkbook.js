import { IMPORT_LIMITS } from "./questionImport.js";
const fail = (message) => { throw new Error(message); };
function xml(text) {
  if (!text || /<!DOCTYPE|<!ENTITY/i.test(text) || (text.match(/</g) || []).length > 30000) fail("Workbook XML is missing, too complex or uses unsupported entities. Export plain question values.");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) fail("Workbook XML is corrupt. Export the file again.");
  return doc;
}
const elements = (node, name) => [...node.getElementsByTagNameNS("*", name)];
export function workbookSheets(files) {
  const book = xml(files["xl/workbook.xml"]), rels = xml(files["xl/_rels/workbook.xml.rels"]);
  const targets = new Map(elements(rels, "Relationship").map((r) => [r.getAttribute("Id"), r]));
  const sheets = elements(book, "sheet").map((s) => {
    const relation = targets.get(s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
    if (!relation || relation.getAttribute("TargetMode") === "External") fail("External sheet references are unsupported.");
    const target = relation.getAttribute("Target"), path = target.startsWith("/xl/") ? target.slice(1) : "xl/" + target;
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path) || !files[path]) fail("A worksheet is missing or uses an unsupported relationship.");
    return { name: s.getAttribute("name"), path };
  });
  if (!sheets.length || sheets.length > 5) fail("Use a workbook with 1–5 worksheets, and import one sheet at a time.");
  return sheets;
}
export function readWorkbookSheet(files, sheet) {
  const doc = xml(files[sheet.path]);
  if (elements(doc, "f").length) fail("The selected sheet contains formulas. Export their values to a new .xlsx/CSV sheet; formulas are never executed or accepted as answers.");
  if (elements(doc, "mergeCell").length) fail("Merged cells make question columns ambiguous. Unmerge the selected sheet or export the template layout.");
  const shared = files["xl/sharedStrings.xml"] ? elements(xml(files["xl/sharedStrings.xml"]), "si").map((s) => elements(s, "t").map((t) => t.textContent).join("")) : [];
  if (shared.length > 5000 || shared.some((s) => s.length > IMPORT_LIMITS.cell)) fail("Workbook contains too many or oversized shared text values.");
  const rows = []; let previousRow = 0;
  for (const node of elements(doc, "row")) {
    const row = Number(node.getAttribute("r")); if (!Number.isInteger(row) || row <= previousRow) fail("Worksheet has invalid, duplicate or unordered row references."); previousRow = row;
    const values = [];
    for (const cell of elements(node, "c")) {
      const match = cell.getAttribute("r")?.match(/^([A-Z]+)(\d+)$/); if (!match || Number(match[2]) !== row) fail("Worksheet has invalid cell references.");
      let column = 0; for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64; column--;
      const type = cell.getAttribute("t"), raw = elements(cell, "v")[0]?.textContent ?? "";
      if (type === "s" && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))) fail("Workbook has an invalid shared string reference.");
      let value = type === "inlineStr" ? elements(cell, "t").map((t) => t.textContent).join("") : type === "s" ? shared[Number(raw)] : raw;
      if (![null, "n", "s", "str", "inlineStr"].includes(type)) fail("Use text or number question cells. Boolean/error/date cells are unsupported; export them as text.");
      if (value === undefined) fail("Workbook refers to a missing shared string.");
      if (value.length > IMPORT_LIMITS.cell) fail("A worksheet cell exceeds 4096 characters.");
      if (column >= IMPORT_LIMITS.columns) { if (value.trim()) fail("Use at most 24 populated columns."); continue; }
      if (values[column] !== undefined) fail("Worksheet contains duplicate cell references.");
      values[column] = value;
    }
    if (values.some((s) => s?.trim())) { if (row > IMPORT_LIMITS.rows + 1) fail("Use the first 500 source rows after the header."); rows.push({ row, values }); }
    if (rows.length > IMPORT_LIMITS.rows + 1) fail("Use at most 500 question-source rows.");
  }
  if (!rows.length) fail("The selected sheet is empty. Use the provided template.");
  const headers = Array.from({ length: rows[0].values.length }, (_, i) => (rows[0].values[i] || "").trim()); rows.shift();
  if (headers.some((h) => !h) || new Set(headers).size !== headers.length) fail("The first populated row must have distinct, nonempty column headers. Use the template or map your headers.");
  if (rows.some((r) => r.values.slice(headers.length).some((v) => v?.trim()))) fail("A row has populated cells beyond the header columns. Add headers or export a consistent table; no cells were discarded.");
  return { kind: "table", headers, rows: rows.map((r) => ({ ...r, values: Array.from({ length: headers.length }, (_, i) => r.values[i] || "") })), label: `Sheet ${sheet.name}`, warnings: ["Only the selected worksheet is imported. Other worksheets are retained in the source file."] };
}
