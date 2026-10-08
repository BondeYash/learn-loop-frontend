export const IMPORT_LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, csvBytes: 2 * 1024 * 1024, pages: 20, ocrPages: 6, questions: 40, detectedQuestions: 500, blockOptions: 80, rows: 500, columns: 24, cell: 4096, text: 500000, expanded: 16 * 1024 * 1024, entries: 128, pixels: 2500000, reviewPage: 5 });
export const TABLE_FIELDS = ["question", "option_a", "option_b", "option_c", "option_d", "option_e", "option_f", "correct_answer", "explanation", "topic"];
export const REVIEW_FLAGS = { table: "Imported spreadsheet/CSV: verify against the source row.", pdf_text: "Detected PDF text: verify question boundaries and reading order.", ocr: "OCR can misread letters, numbers and Hindi glyphs. Verify against the PDF.", low_confidence: "OCR confidence is low; carefully correct the text.", layout: "Ambiguous layout or numbering: check boundaries, columns and options.", diagram: "An image/diagram may be required. Describe it fully in text or remove the question.", separate_key: "Answer came from a separate key section. Verify its question number.", missing_key: "No unambiguous answer key was found. Select the correct option yourself.", missing_explanation: "No explanation was supplied. Explanations are optional; you can leave this blank.", manual: "Manually mapped/transcribed content needs review." };
const fail = (message) => { throw new Error(message); };
export const blankImportedQuestion = (source = "Manual transcription") => ({ prompt: "", options: ["", ""], correctIndex: null, explanation: "", topic: "", importReview: { source, flags: ["manual"], checked: false } });
export function draftQuestionErrors(q) {
  const errors = [];
  if (typeof q.prompt !== "string" || q.prompt.length > 1200) errors.push("Question text must fit the 1200-character limit.");
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) errors.push("Each question needs 2–6 options. Split merged questions in the extracted text and detect again, or remove extra options after checking the source.");
  if (Array.isArray(q.options) && q.options.some((s) => typeof s !== "string" || s.length > 400)) errors.push("Each option must fit the 400-character limit.");
  if (q.correctIndex !== null && (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= (q.options?.length || 0))) errors.push("The answer must refer to an option in this question.");
  if (q.explanation != null && (typeof q.explanation !== "string" || q.explanation.length > 2000)) errors.push("The optional explanation must be text of at most 2000 characters.");
  if (typeof q.topic !== "string" || q.topic.length > 80) errors.push("Topic tags have an 80-character limit.");
  return errors;
}
export function questionErrors(q) {
  const errors = [];
  if (!q.prompt?.trim() || q.prompt.length > 1200) errors.push("Question text is required, up to 1200 characters.");
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some((s) => !s.trim() || s.length > 400)) errors.push("Use 2–6 nonempty options, up to 400 characters each.");
  if (Array.isArray(q.options) && new Set(q.options.map((s) => s.trim().toLocaleLowerCase())).size !== q.options.length) errors.push("Options must be distinct.");
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= (q.options?.length || 0)) errors.push("Choose the correct option.");
  if (q.explanation != null && (typeof q.explanation !== "string" || q.explanation.length > 2000)) errors.push("The optional explanation must be text of at most 2000 characters.");
  if ((q.topic || "").length > 80) errors.push("Topic tags have an 80-character limit.");
  return errors;
}
const finish = (q) => {
  if (q.options.length > 6) { q.importReview.flags.push("layout"); q.correctIndex = null; }
  while (q.options.length < 2) q.options.push("");
  if (q.correctIndex === null) q.importReview.flags.push("missing_key");
  if (!q.explanation.trim()) q.importReview.flags.push("missing_explanation");
  q.importReview.flags = [...new Set(q.importReview.flags)];
  return q;
};
export function parseCsv(input, delimiter = "auto") {
  if (input.length > IMPORT_LIMITS.csvBytes || input.includes("\0")) fail("CSV is too large or contains binary data. Use a UTF-8 CSV up to 2 MiB.");
  const text = input.replace(/^\uFEFF/, "");
  if (delimiter === "auto") {
    const header = text.split(/\r?\n/, 1)[0];
    delimiter = [",", ";", "\t"].map((d) => [d, header.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  }
  if (![",", ";", "\t"].includes(delimiter)) fail("Choose comma, semicolon or tab as the delimiter.");
  const rows = []; let row = [], value = "", quoted = false, closed = false, line = 1, rowLine = 1;
  const cell = () => { if (value.length > IMPORT_LIMITS.cell) fail(`CSV line ${rowLine}: a cell exceeds 4096 characters.`); row.push(value); value = ""; closed = false; if (row.length > IMPORT_LIMITS.columns) fail("Use at most 24 columns."); };
  const record = () => { cell(); if (row.some((v) => v.trim())) rows.push({ row: rowLine, values: row }); row = []; if (rows.length > IMPORT_LIMITS.rows + 1) fail("Use at most 500 source rows, excluding the header."); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else { value += ch; if (ch === "\n") line++; } }
    else if (ch === '"') { if (value || closed) fail(`CSV line ${line}: malformed quoted field.`); quoted = true; }
    else if (ch === delimiter) cell();
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; record(); line++; rowLine = line; }
    else { if (closed) fail(`CSV line ${line}: unexpected text after a closing quote.`); value += ch; }
  }
  if (quoted) fail("CSV has an unterminated quoted field. Export it again as UTF-8 CSV.");
  if (value || row.length || closed) record();
  if (!rows.length) fail("The file is empty. Use the provided header template.");
  const headers = rows.shift().values.map((v) => v.trim());
  if (headers.some((v) => !v) || new Set(headers).size !== headers.length) fail("Use distinct, nonempty column headers in the first row.");
  if (rows.some((r) => r.values.length !== headers.length)) fail("CSV rows have inconsistent column counts. Check delimiter and quoting.");
  return { kind: "table", headers, rows, label: "CSV", warnings: [] };
}
const normalized = (s) => s.trim().toLocaleLowerCase().replace(/[\s-]+/g, "_");
export function defaultMapping(headers) {
  const aliases = { question: ["question", "prompt", "question_text"], correct_answer: ["correct_answer", "answer", "answer_key"], explanation: ["explanation", "solution"], topic: ["topic", "topic_tag"] };
  return Object.fromEntries(TABLE_FIELDS.map((field) => [field, headers.findIndex((h) => (aliases[field] || [field, field.replace("option_", "option "), field.replace("option_", "")]).map(normalized).includes(normalized(h)))]));
}
function answerIndex(value, options) {
  const key = value.trim();
  if (!key) return null;
  if (/^[A-F]$/i.test(key)) { const n = key.toUpperCase().charCodeAt(0) - 65; return n < options.length ? n : null; }
  if (/^[1-6]$/.test(key)) { const n = Number(key) - 1; return n < options.length ? n : null; }
  const hits = options.map((v, i) => v.trim() === key ? i : -1).filter((i) => i !== -1);
  return hits.length === 1 ? hits[0] : null;
}
export function questionsFromTable(table, mapping) {
  if (TABLE_FIELDS.some((f) => !Number.isInteger(mapping[f]) || mapping[f] < -1 || mapping[f] >= table.headers.length)) fail("Use valid source columns for every mapped field.");
  if (mapping.question < 0 || mapping.option_a < 0 || mapping.option_b < 0) fail("Map a question column and at least options A and B.");
  const used = TABLE_FIELDS.map((f) => mapping[f]).filter((i) => i >= 0);
  if (new Set(used).size !== used.length) fail("Each mapped field must use a different source column.");
  const result = [];
  for (const row of table.rows) {
    const get = (field) => mapping[field] >= 0 ? String(row.values[mapping[field]] ?? "").trim() : "";
    if (!TABLE_FIELDS.some((f) => get(f))) continue;
    const options = TABLE_FIELDS.slice(1, 7).filter((f) => mapping[f] >= 0).map(get);
    while (options.length > 2 && !options[options.length - 1]) options.pop();
    const q = { prompt: get("question"), options, correctIndex: answerIndex(get("correct_answer"), options), explanation: get("explanation"), topic: get("topic"), importReview: { source: `${table.label} row ${row.row}`, flags: ["table"], checked: false } };
    if (Object.values(mapping).some((i) => i >= row.values.length)) q.importReview.flags.push("layout");
    result.push(finish(q)); if (result.length > IMPORT_LIMITS.questions) fail("Detected more than 40 questions. Split the source file; no questions were applied.");
  }
  if (!result.length) fail("No question rows were found. Check the column mapping.");
  return result;
}
const westernDigits = (s) => s.replace(/[०-९]/g, (v) => String(v.charCodeAt(0) - 0x0966));
const labelIndex = (s) => /^[A-F]$/i.test(s) ? s.toUpperCase().charCodeAt(0) - 65 : ["क", "ख", "ग", "घ", "ङ", "च"].indexOf(s);
// Normalize extraction-only formatting marks, preserving Hindi joiners and the
// untouched source pages. Match offsets still refer to the normalized line.
const readableLine = (s) => s.replace(/[\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "").trim();
function questionHeading(line) {
  const numeric = westernDigits(line);
  const match = numeric.match(/^(?:(?:Q(?:uestion)?|प्रश्न|सवाल)\s*[.:]?\s*)?(?:\((\d{1,3})\)|([1-9]\d{0,2})[.):])\s*(\S.*)$/i);
  if (match) {
    // A decimal in a wrapped prompt/option is not a new question number.
    if (/^[1-9]\d{0,2}\.\d/.test(numeric)) return null;
    return { number: Number(match[1] || match[2]), prompt: line.slice(match[0].length - match[3].length) };
  }
  const prefixed = numeric.match(/^(?:Q(?:uestion)?|प्रश्न|सवाल)\s*[.:]?\s*([1-9]\d{0,2})\s+(.+)$/i);
  return prefixed ? { number: Number(prefixed[1]), prompt: line.slice(prefixed[0].length - prefixed[2].length) } : null;
}
function labelledOptions(line) {
  const pattern = /(?:^|\s)(?:\(([A-Fकखगघङच])\)|([A-Fकखगघङच])[.)])\s*/gi;
  const matches = [...line.matchAll(pattern)];
  if (!matches.length || matches[0].index !== 0) return [];
  return matches.map((m, i) => ({ label: labelIndex(m[1] || m[2]), text: line.slice(m.index + m[0].length, matches[i + 1]?.index ?? line.length).trim() }));
}
function hasFollowingOptions(lines, position) {
  const labels = [];
  for (let i = position + 1; i < Math.min(lines.length, position + 6); i++) {
    if (questionHeading(lines[i].line)) break;
    labels.push(...labelledOptions(lines[i].line).map((o) => o.label));
    if (labels.length >= 2) return labels[0] === 0 && labels[1] === 1;
  }
  return false;
}
export function detectPageQuestions(pages) {
  if (pages.reduce((n, p) => n + p.text.length, 0) > IMPORT_LIMITS.text) fail("Extracted text is too large. Split the document into smaller files.");
  const candidates = [], keys = new Map(); let current = null, field = "prompt", keySection = false;
  const flagPage = (q, page) => {
    q.pages.add(page.page); q.importReview.flags.push(...(page.flags || ["pdf_text"]));
    if (Number.isFinite(page.confidence)) q.importReview.confidence = Math.min(q.importReview.confidence ?? 100, Math.round(page.confidence));
  };
  const lines = pages.flatMap((page) => page.text.split(/\r?\n/).map((raw) => ({ page, line: readableLine(raw) })).filter((entry) => entry.line));
  for (let position = 0; position < lines.length; position++) {
    const { page, line } = lines[position];
    if (/^(answer\s*key|answers\s*:?$|उत्तर\s*(कुंजी|माला)|उत्तरमाला)/i.test(line)) { keySection = true; continue; }
    const numeric = westernDigits(line);
    const heading = questionHeading(line);
    // A question beginning with "A ..." can resemble a key entry. Require a
    // following A/B option pair before returning from a key section to authoring.
    if (keySection && heading && hasFollowingOptions(lines, position)) keySection = false;
    if (keySection) {
      const matches = [...numeric.matchAll(/(?:^|[\s,;])(?:Q\.?\s*)?(\d{1,3})\s*[.):=-]\s*([A-Fकखगघङच])(?=\s|[).,;]|$)/gi)];
      for (const match of matches) { const n = Number(match[1]), index = labelIndex(match[2]), old = keys.get(n); keys.set(n, { index: old && old.index !== index ? null : index, pages: new Set([...(old?.pages || []), page.page]) }); }
      if (matches.length || !heading) continue;
      keySection = false;
    }
    // Explicit section titles are kept in the source preview, not appended to
    // the preceding question's last option.
    const options = labelledOptions(line);
    if (!options.length && !heading && /^[\p{L}].{0,120}\s+\(\s*\d{1,3}\s*[-–]\s*\d{1,3}\s*\)$/u.test(numeric)) { current = null; continue; }
    if (options.length && current) {
      if (current.options.length + options.length > IMPORT_LIMITS.blockOptions) fail(`PDF page ${page.page}, question ${current.number}: more than 80 option lines form one block. Correct its numbered boundaries in the extracted text, then detect again. All source text is retained.`);
      for (const option of options) { current.options.push(option.text); current.labels.push(option.label); }
      if (options.length > 1) { current.ambiguous = true; current.importReview.flags.push("layout"); }
      field = "option"; flagPage(current, page); continue;
    }
    if (heading) {
      current = { prompt: heading.prompt, options: [], correctIndex: null, explanation: "", topic: "", importReview: { source: "", flags: [], checked: false }, number: heading.number, labels: [], pages: new Set(), explicitKey: null, explicitConflict: false, ambiguous: false };
      flagPage(current, page); candidates.push(current); field = "prompt";
      if (candidates.length > IMPORT_LIMITS.detectedQuestions) fail("Detected more than 500 question boundaries. Split the source or correct its numbering in the extracted text; nothing was applied.");
      continue;
    }
    if (!current) continue;
    flagPage(current, page);
    const answer = numeric.match(/^(?:correct\s*answer|answer|ans\.?|उत्तर)\s*[:=-]\s*([A-F1-6कखगघङच])\s*[.)]?\s*$/i);
    if (answer) { const key = /^[1-6]$/.test(answer[1]) ? Number(answer[1]) - 1 : labelIndex(answer[1]); if (current.explicitKey !== null && current.explicitKey !== key) current.explicitConflict = true; current.explicitKey = key; field = "prompt"; continue; }
    const explanation = line.match(/^(?:explanation|solution|व्याख्या|समाधान)\s*[:=-]\s*(.*)$/i);
    if (explanation) { current.explanation = explanation[1]; field = "explanation"; continue; }
    if (/^[^\s]{1,3}[.)]\s+/.test(line)) { current.ambiguous = true; current.importReview.flags.push("layout"); }
    if (field === "option" && current.options.length) current.options[current.options.length - 1] += "\n" + line;
    else current[field] += "\n" + line;
    if (/(diagram|figure|image|चित्र|आरेख)/i.test(line)) current.importReview.flags.push("diagram");
  }
  const numbers = candidates.map((q) => q.number);
  return candidates.map((q) => {
    if (numbers.filter((n) => n === q.number).length > 1 || q.labels.some((v, i) => v !== i)) q.importReview.flags.push("layout");
    const key = keys.get(q.number);
    if (key) { q.importReview.flags.push("separate_key"); for (const ref of key.pages) flagPage(q, pages.find((p) => p.page === ref)); if (key.index === null) q.importReview.flags.push("layout"); }
    const candidate = q.explicitKey ?? key?.index ?? null;
    q.correctIndex = q.labels.every((v, i) => v === i) && candidate !== null && candidate < q.options.length ? candidate : null;
    if (q.explicitKey !== null && key && key.index !== q.explicitKey) { q.correctIndex = null; q.importReview.flags.push("layout"); }
    if (q.explicitConflict || q.ambiguous || numbers.filter((n) => n === q.number).length > 1) { q.correctIndex = null; q.importReview.flags.push("layout"); }
    if (/(diagram|figure|image|चित्र|आरेख)/i.test(q.prompt)) q.importReview.flags.push("diagram");
    q.importReview.source = `PDF page${q.pages.size > 1 ? "s" : ""} ${[...q.pages].join(", ")} · question ${q.number}`;
    const { number, labels, pages: refs, explicitKey, explicitConflict, ambiguous, ...question } = q; void number; void labels; void refs; void explicitKey; void explicitConflict; void ambiguous;
    return finish(question);
  });
}
export function selectPageQuestions(detected, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > detected.length) fail(`Choose a valid detected-question range from 1 to ${detected.length}.`);
  if (end - start + 1 > IMPORT_LIMITS.questions) fail("Choose at most 40 detected questions for one assessment. Other questions remain in the source for a separate import.");
  return detected.slice(start - 1, end);
}
export function questionsFromPages(pages) {
  const detected = detectPageQuestions(pages);
  if (detected.length > IMPORT_LIMITS.questions) fail("Detected more than 40 question boundaries. Choose a range in the PDF importer or split the source; nothing was applied.");
  return detected;
}
