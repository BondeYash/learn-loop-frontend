import test from "node:test";
import assert from "node:assert/strict";
import { publicationErrors } from "../src/services/assessmentValidation.js";
import { draftQuestionErrors, questionErrors, questionsFromPages, questionsFromTable, parseCsv, defaultMapping } from "../src/services/questionImport.js";

const question = { prompt: "A complete question", options: ["First", "Second"], correctIndex: 1, topic: "" };
test("manual questions accept omitted, null, empty and whitespace explanations", () => {
  for (const explanation of [undefined, null, "", "  \n  ", "Optional reason"]) {
    const q = { ...question, explanation };
    assert.deepEqual(questionErrors(q), []); assert.deepEqual(draftQuestionErrors(q), []); assert.deepEqual(publicationErrors([q]), []);
  }
  for (const explanation of [42, {}, "x".repeat(2001)]) assert.ok(publicationErrors([{ ...question, explanation }]).length);
});
test("CSV and PDF questions without explanations can be reviewed and published", () => {
  const table = parseCsv("question,option_a,option_b,correct_answer\nA question,First,Second,B\n");
  const csv = questionsFromTable(table, defaultMapping(table.headers))[0];
  const pdf = questionsFromPages([{ page: 1, flags: ["pdf_text"], text: "1. A question\nA. First\nB. Second\nAnswer: B" }])[0];
  for (const q of [csv, pdf]) {
    assert.equal(q.explanation, ""); assert.ok(q.importReview.flags.includes("missing_explanation")); assert.deepEqual(questionErrors(q), []);
    assert.match(publicationErrors([q])[0].message, /mark it reviewed/);
    assert.deepEqual(publicationErrors([{ ...q, importReview: { ...q.importReview, checked: true } }]), []);
  }
});
test("publish errors identify every incomplete question and preserve required answer/option checks", () => {
  assert.match(publicationErrors([])[0].message, /at least one complete question/);
  const errors = publicationErrors([question, { ...question, correctIndex: null }, { ...question, prompt: "", options: ["Same", " same "] }]);
  assert.deepEqual([...new Set(errors.map((e) => e.index))], [1, 2]);
  assert.ok(errors.some((e) => e.index === 1 && /correct option/.test(e.message)));
  assert.ok(errors.some((e) => e.index === 2 && /Question text/.test(e.message)));
  assert.ok(errors.some((e) => e.index === 2 && /distinct/.test(e.message)));
  for (const options of [["", "Second"], ["Only"], Array(7).fill("Option")]) assert.ok(publicationErrors([{ ...question, options }]).length);
  assert.ok(publicationErrors(Array(41).fill(question)).some((e) => /at most 40/.test(e.message)));
});
