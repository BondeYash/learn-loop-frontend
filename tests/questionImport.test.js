import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { parseCsv, defaultMapping, questionsFromTable, questionsFromPages, detectPageQuestions, selectPageQuestions, draftQuestionErrors, questionErrors, TABLE_FIELDS } from "../src/services/questionImport.js";
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
test("OCR headings/options without spaces do not merge adjacent questions", () => {
  const text = "10. Previous question\na)First\nb)Second\n11.'Named icon' represents:\na)One\nb)Two\n20.What is the shortcut?\na)Ctrl + I\nb)Ctrl + B\nAnswer key\n10.a) First\n11.b) Two\n20.b) Ctrl + B";
  const qs = questionsFromPages([page(text, 2, ["ocr"], 90)]);
  assert.deepEqual(qs.map((q) => q.options.length), [2, 2, 2]); assert.equal(qs[1].prompt, "'Named icon' represents:"); assert.equal(qs[2].prompt, "What is the shortcut?"); assert.deepEqual(qs.map((q) => q.correctIndex), [0, 1, 1]); assert.ok(qs.every((q) => !q.importReview.checked));
});
test("parenthesized/prefixed bilingual numbering and invisible PDF marks preserve text", () => {
  const qs = questionsFromPages([page("(१)\u200Bपहला?\n(क)प्रथम\n(ख)द्वितीय\nउत्तर: २\nQ.2 Second?\n(a)Yes\n(b)No\nप्रश्न ३: तीसरा?\nक)क्\u200Dष\nख)अन्य\nउत्तर कुंजी\n२.a) Yes\n३.ख) अन्य")]);
  assert.deepEqual(qs.map((q) => q.prompt), ["पहला?", "Second?", "तीसरा?"]); assert.equal(qs[2].options[0], "क्\u200Dष"); assert.deepEqual(qs.map((q) => q.correctIndex), [1, 0, 1]);
});
test("malformed merged blocks preserve all options, clear keys and block draft transfer", () => {
  const [q] = questionsFromPages([page("1. Merged block\nA. One\nB. Two\nC. Three\nD. Four\nUnnumbered second prompt\nA. Five\nB. Six\nC. Seven\nD. Eight\nAnswer: B")]);
  assert.equal(q.options.length, 8); assert.equal(q.options[7], "Eight"); assert.match(q.options[3], /Unnumbered second prompt/); assert.equal(q.correctIndex, null); assert.ok(q.importReview.flags.includes("layout")); assert.match(draftQuestionErrors(q).join(" "), /Split merged questions/);
  const repaired = questionsFromPages([page("1. First prompt\nA. One\nB. Two\n2. Second prompt\nA. Three\nB. Four")]); assert.equal(repaired.length, 2); assert.ok(repaired.every((q) => draftQuestionErrors(q).length === 0 && q.correctIndex === null));
});
test("inline options and OCR label noise stay recoverable with no chosen key", () => {
  const [inline] = questionsFromPages([page("1. Inline\nA. First B. Second C. Third\nAnswer: B")]); assert.deepEqual(inline.options, ["First", "Second", "Third"]); assert.equal(inline.correctIndex, null); assert.ok(inline.importReview.flags.includes("layout"));
  const [noise] = questionsFromPages([page("1. Noisy labels\na) First\nb) Second\n¢) Third\nd) Fourth\nAnswer: B", 1, ["ocr"])]); assert.match(noise.options[1], /¢\) Third/); assert.equal(noise.correctIndex, null); assert.ok(noise.importReview.flags.includes("layout"));
});
test("section titles and decimal continuations do not corrupt question boundaries", () => {
  const qs = questionsFromPages([page("1. Choose the frequency\nA. Band\n2.4 GHz supported\nB. Other (1-2)\nWord Processing (2-3)\n2.Second question\nA. First\nB. Second")]); assert.equal(qs.length, 2); assert.equal(qs[0].options[0], "Band\n2.4 GHz supported"); assert.equal(qs[0].options[1], "Other (1-2)");
});
test("all 100 detected PDF questions and keys survive explicit 40/40/20 range selection", () => {
  const detected = detectPageQuestions([page(Array.from({ length: 100 }, (_, i) => numbered(i + 1)).join("\n")), page("Answer key\n" + Array.from({ length: 100 }, (_, i) => `${i + 1}.b) Second`).join("\n"), 2)]);
  assert.equal(detected.length, 100); const batches = [[1, 40], [41, 80], [81, 100]].map(([a, b]) => selectPageQuestions(detected, a, b)); assert.deepEqual(batches.map((q) => q.length), [40, 40, 20]); assert.deepEqual(batches.flat(), detected); assert.ok(detected.every((q) => q.correctIndex === 1 && q.importReview.source.includes("1, 2") && q.explanation === ""));
  for (const range of [[1, 41], [0, 10], [2, 1], [1, 101], [1.5, 2], ["1", 2]]) assert.throws(() => selectPageQuestions(detected, ...range));
});
test("pathologically merged option and question blocks remain bounded without truncation", () => {
  assert.throws(() => detectPageQuestions([page("1. Block\n" + Array.from({ length: 81 }, (_, i) => `${String.fromCharCode(65 + i % 4)}. Option ${i}`).join("\n"))]), /more than 80.*All source text is retained/);
  assert.throws(() => detectPageQuestions([page(Array.from({ length: 501 }, (_, i) => numbered(i + 1)).join("\n"))]), /more than 500/);
});
test("draft transfer enforces field/option bounds while allowing missing reviewed content", () => {
  const [q] = questionsFromPages([page("1. Incomplete\nA. One\nB. Two")]); assert.deepEqual(draftQuestionErrors(q), []); assert.ok(questionErrors(q).length > 0);
  for (const patch of [{ prompt: "x".repeat(1201) }, { options: ["x".repeat(401), "Other"] }, { explanation: "x".repeat(2001) }, { topic: "x".repeat(81) }, { correctIndex: 2 }]) assert.ok(draftQuestionErrors({ ...q, ...patch }).length);
});
test("a following question beginning with A is not consumed as a separate answer-key entry", () => {
  const qs = questionsFromPages([page("1. First question\nA. Yes\nB. No\nAnswer key\n1.A\n2. A computer is which device?\nA. First\nB. Second\nAnswer: B")]);
  assert.equal(qs.length, 2); assert.equal(qs[0].correctIndex, 0); assert.equal(qs[1].correctIndex, 1); assert.equal(qs[1].prompt, "A computer is which device?");
});
test("separate OCR key warnings/confidence and every conflicting key page stay attached", () => {
  const [q] = questionsFromPages([page(numbered(1)), page("Answer key\n1.A", 2, ["ocr", "low_confidence"], 61), page("Answer key\n1.B", 3)]);
  assert.equal(q.correctIndex, null); assert.equal(q.importReview.confidence, 61); assert.match(q.importReview.source, /1, 2, 3/); for (const flag of ["separate_key", "ocr", "low_confidence", "layout", "missing_key"]) assert.ok(q.importReview.flags.includes(flag));
});
test("macro, unsafe paths, oversized expansion, incomplete/non-Excel and too many ZIP entries reject", () => {
  const archive = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([n, v]) => [n, strToU8(v)])));
  for (const files of [{ "xl/vbaProject.bin": "macro" }, { "../evil.xml": "unsafe" }, { "xl/worksheets/sheet1.xml": "x".repeat(2 * 1024 * 1024 + 1) }, { "ignored.bin": "x".repeat(16 * 1024 * 1024 + 1) }, Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`file${i}`, "x"]))]) assert.throws(() => boundedWorkbookArchive(archive(files)));
  assert.throws(() => boundedWorkbookArchive(new Uint8Array([1, 2, 3]))); assert.throws(() => boundedWorkbookArchive(spreadsheetTemplate().slice(0, -24)), /incomplete|corrupt/);
});
