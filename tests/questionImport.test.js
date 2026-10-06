import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parseCsv, defaultMapping, questionsFromTable, questionsFromPages, questionErrors, TABLE_FIELDS } from "../src/services/questionImport.js";
import { boundedWorkbookArchive, spreadsheetTemplate } from "../src/services/importArchive.js";
const csv = (rows) => TABLE_FIELDS.join(",") + "\n" + rows;
const tableQuestions = (text) => { const table = parseCsv(text); return questionsFromTable(table, defaultMapping(table.headers)); };
const page = (text, n = 1, flags = ["pdf_text"], confidence) => ({ text, page: n, flags, confidence });
const numbered = (n, tail = "") => `${n}. Synthetic question ${n}\nA. First\nB. Second\n${tail}`;
test("CSV preserves BOM, CRLF, quoted delimiters/newlines, doubled quotes and Hindi", () => {
  const source = '\uFEFF' + csv('"कौन, सा प्रश्न?\nदूसरी पंक्ति",पहला,"दूसरा ""विकल्प""",,,,,B,"दी गई व्याख्या",भाषा\r\n');
  const [q] = tableQuestions(source); assert.equal(q.prompt, "कौन, सा प्रश्न?\nदूसरी पंक्ति"); assert.equal(q.options[1], 'दूसरा "विकल्प"'); assert.equal(q.correctIndex, 1); assert.equal(q.importReview.source, "CSV row 2"); assert.equal(q.importReview.checked, false); assert.deepEqual(questionErrors(q), []);
});
test("delimiter detection and explicit semicolon/tab mapping", () => {
  for (const d of [";", "\t"]) { const source = ["question", "option_a", "option_b", "correct_answer", "explanation"].join(d) + "\n" + ["Q", "X", "Y", "Y", "Reason"].join(d); assert.equal(tableQuestions(source)[0].correctIndex, 1); }
});
test("partial rows and absent/ambiguous keys remain editable, with no fabricated explanation", () => {
  const [q] = tableQuestions(csv("Question,A,B,,,,,Z,,\n")); assert.equal(q.correctIndex, null); assert.equal(q.explanation, ""); assert.ok(q.importReview.flags.includes("missing_key")); assert.ok(q.importReview.flags.includes("missing_explanation")); assert.ok(questionErrors(q).length);
  assert.equal(tableQuestions(csv(",,,,,,,A,,\n")).length, 1);
});
test("all 40 rows preserved; over-limit import rejects rather than truncates", () => {
  const rows = (count) => Array.from({ length: count }, (_, i) => `Question ${i},A,B,,,,,A,Reason,`).join("\n"); assert.equal(tableQuestions(csv(rows(40))).length, 40); assert.throws(() => tableQuestions(csv(rows(41))), /more than 40/);
});
test("malformed quoted CSV, row widths, duplicate headers, binary, cells and table limits reject", () => {
  for (const text of ['q,a\n"open,A', 'q,a\n"closed"bad,A', 'q,a\nA', 'q,q\nA,B', 'q,a\nA,\0', 'q,a\n' + "x".repeat(4097) + ',A', Array(25).fill("header").join(","), 'q,a\n' + Array(501).fill("Q,A").join("\n")]) assert.throws(() => parseCsv(text));
});
test("manual mapping rejects reused/missing/out-of-range source columns", () => {
  const table = parseCsv("question,option_a,option_b\nQ,A,B"), map = defaultMapping(table.headers);
  for (const patch of [{ option_a: 0 }, { question: -1 }, { option_c: 100 }, { topic: 1.5 }]) assert.throws(() => questionsFromTable(table, { ...map, ...patch }));
});
test("multipage PDF continuations, key page refs and supplied explanations stay associated", () => {
  const [q] = questionsFromPages([page("1. Prompt\nA. First"), page("continued option\nB. Second\nExplanation: Supplied reason.", 2), page("Answer key\n1.B", 3)]); assert.equal(q.options[0], "First\ncontinued option"); assert.equal(q.correctIndex, 1); assert.equal(q.explanation, "Supplied reason."); assert.match(q.importReview.source, /1, 2, 3/); assert.ok(q.importReview.flags.includes("separate_key"));
});
test("Hindi numbering, option labels, answers and OCR confidence are preserved", () => {
  const [q] = questionsFromPages([page("१. सही विकल्प?\nक. पहला\nख. दूसरा\nउत्तर: ख\nव्याख्या: दी गई व्याख्या", 1, ["ocr", "low_confidence"], 62)]); assert.equal(q.correctIndex, 1); assert.equal(q.prompt, "सही विकल्प?"); assert.equal(q.importReview.confidence, 62); assert.equal(q.importReview.checked, false);
});
test("conflicting inline/separate keys and repeated question numbers never choose an answer", () => {
  const sources = [numbered(1, "Answer: A\nAnswer: B"), numbered(1, "Answer: A\nAnswer key\n1.B"), numbered(1) + numbered(1) + "Answer key\n1.A", numbered(1, "Answer key\n1.A 1.B")];
  for (const text of sources) assert.ok(questionsFromPages([page(text)]).every((q) => q.correctIndex === null));
});
test("PDF missing labels, diagrams, absent boundaries and question/text caps stay reviewable or reject", () => {
  const [q] = questionsFromPages([page("1. Refer to figure\nA. X\nC. Y\nAnswer: A")]); assert.equal(q.correctIndex, null); assert.ok(q.importReview.flags.includes("layout")); assert.ok(q.importReview.flags.includes("diagram")); assert.deepEqual(questionsFromPages([page("Unnumbered content")]), []);
  assert.throws(() => questionsFromPages([page(Array.from({ length: 41 }, (_, i) => numbered(i + 1)).join("\n"))]), /more than 40/); assert.throws(() => questionsFromPages([page("x".repeat(500001))]), /too large/);
});
test("Excel template is a bounded valid OOXML archive with headers only", () => {
  const files = boundedWorkbookArchive(spreadsheetTemplate()); assert.match(files["xl/worksheets/sheet1.xml"], /correct_answer/); assert.equal((files["xl/worksheets/sheet1.xml"].match(/<row /g) || []).length, 1);
});
test("macro, unsafe paths, oversized expansion, incomplete/non-Excel and too many ZIP entries reject", () => {
  const archive = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([n, v]) => [n, strToU8(v)])));
  for (const files of [{ "xl/vbaProject.bin": "macro" }, { "../evil.xml": "unsafe" }, { "xl/worksheets/sheet1.xml": "x".repeat(2 * 1024 * 1024 + 1) }, { "ignored.bin": "x".repeat(16 * 1024 * 1024 + 1) }, Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`file${i}`, "x"]))]) assert.throws(() => boundedWorkbookArchive(archive(files)));
  assert.throws(() => boundedWorkbookArchive(new Uint8Array([1, 2, 3]))); assert.throws(() => boundedWorkbookArchive(spreadsheetTemplate().slice(0, -24)), /incomplete|corrupt/);
});
