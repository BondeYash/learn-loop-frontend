import { useEffect, useRef, useState } from "react";
import { useDecision } from "./DecisionProvider.jsx";
import AssessmentQuestionFields from "./AssessmentQuestionFields.jsx";
import { extractQuestionFile } from "../services/extractQuestionFile.js";
import { readWorkbookSheet } from "../services/importWorkbook.js";
import { spreadsheetTemplate } from "../services/importArchive.js";
import { blankImportedQuestion, defaultMapping, IMPORT_LIMITS, questionsFromPages, questionsFromTable, TABLE_FIELDS } from "../services/questionImport.js";

function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })), a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function QuestionImport({ existingCount, onApply, onClose }) {
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState(""), [error, setError] = useState(""), [source, setSource] = useState(null), [mapping, setMapping] = useState({}), [questions, setQuestions] = useState(null), [chunk, setChunk] = useState(0), [mode, setMode] = useState("append"), [language, setLanguage] = useState("eng"), [delimiter, setDelimiter] = useState("auto"), [forceOcr, setForceOcr] = useState(false), [pageIndex, setPageIndex] = useState(0);
  const action = useRef(null), pending = useRef(false), applying = useRef(false), mounted = useRef(true), decide = useDecision();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; action.current?.abort(); }; }, []);
  const extract = async () => {
    if (!file || pending.current) return; pending.current = true; setBusy(true); setError(""); setSource(null); setQuestions(null);
    const controller = new AbortController(); action.current = controller; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 240000);
    try {
      const result = await extractQuestionFile(file, { signal: controller.signal, language, delimiter, forceOcr, progress: (s) => { if (mounted.current && !controller.signal.aborted) setProgress(s); } });
      if (controller.signal.aborted || !mounted.current) return;
      setSource(result); setChunk(0); setPageIndex(0);
      if (result.kind === "table") setMapping(defaultMapping(result.headers));
      else setQuestions(questionsFromPages(result.pages));
    } catch (e) { if (mounted.current) setError(timedOut ? "Import reached the 4-minute limit. Split the file or use CSV/Excel; your assessment is unchanged." : e.message); }
    finally { clearTimeout(timer); pending.current = false; if (mounted.current) { setBusy(false); setProgress(""); } }
  };
  const close = async () => {
    if (busy) { action.current?.abort(); return; }
    if (questions?.length && !await decide({ title: "Discard this import review?", body: "These pending questions have not been added to the assessment. Your existing questions are retained.", confirmLabel: "Discard import", destructive: true })) return;
    onClose();
  };
  const detect = () => { try { setQuestions(source.kind === "table" ? questionsFromTable(source, mapping) : questionsFromPages(source.pages)); setChunk(0); setError(""); } catch (e) { setError(e.message); } };
  const chooseSheet = (path) => { try { const sheet = source.workbook.sheets.find((s) => s.path === path), table = readWorkbookSheet(source.workbook.files, sheet); setSource({ ...table, workbook: { ...source.workbook, selected: path } }); setMapping(defaultMapping(table.headers)); setError(""); } catch (e) { setError(e.message); } };
  const total = (mode === "append" ? existingCount : 0) + (questions?.length || 0), remaining = questions?.filter((q) => !q.importReview.checked).length || 0;
  const apply = async () => {
    if (applying.current || !questions?.length || total > 40) return; applying.current = true;
    try { if (await decide({ title: mode === "replace" ? "Replace the assessment questions?" : "Add imported questions to the draft?", body: `${mode === "replace" ? `${existingCount} existing questions will be replaced` : `${existingCount} existing questions will be retained`}. ${questions.length} imported questions will be added (${total} total). ${remaining} still need review. Nothing is saved or published until you use the assessment's save controls.`, confirmLabel: "Confirm import", destructive: mode === "replace" && existingCount > 0 }) && mounted.current) onApply(questions, mode); } finally { applying.current = false; }
  };
  const pages = Math.max(1, Math.ceil((questions?.length || 0) / IMPORT_LIMITS.reviewPage)), currentChunk = Math.min(chunk, pages - 1);
  return <section aria-label="Question file import" className="mt-5 min-w-0 rounded-2xl border border-line p-4 sm:p-5">
    <h3 className="text-xl font-semibold">Import questions from PDF, Excel or CSV</h3>
    <p className="mt-3 text-sm leading-7 text-muted">Files are read on this device. Scanned PDFs use local English or Hindi + English OCR. Check every result against your source; missing answers and explanations remain blank. Add reviewed questions to the draft, then save or publish.</p>
    {!questions && <fieldset disabled={busy} className="mt-4 min-w-0 space-y-4">
      <div className="flex flex-wrap gap-3"><button className="btn-secondary" type="button" onClick={() => download("\uFEFF" + TABLE_FIELDS.join(",") + "\r\n", "question-template.csv", "text/csv;charset=utf-8")}>Download CSV template</button><button className="btn-secondary" type="button" onClick={() => download(spreadsheetTemplate(), "question-template.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Download Excel template</button></div>
      <label className="block text-sm font-semibold">Question file<input aria-label="Question file" type="file" className="mt-2 block w-full min-w-0 text-sm" accept=".pdf,.xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setSource(null); setError(""); }} /></label>
      <p className="text-sm leading-6 text-muted">PDF/Excel: 10 MiB. CSV: 2 MiB UTF-8. Up to 20 PDF pages (6 OCR pages), 500 table rows, 24 columns and 40 questions. Legacy .xls needs conversion to .xlsx/CSV.</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">OCR language<select aria-label="OCR language" className="input-field mt-2" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="eng">English</option><option value="eng+hin">Hindi + English</option></select></label><label className="text-sm font-semibold">CSV delimiter<select aria-label="CSV delimiter" className="input-field mt-2" value={delimiter} onChange={(e) => setDelimiter(e.target.value)}><option value="auto">Detect automatically</option><option value=",">Comma</option><option value=";">Semicolon</option><option value={"\t"}>Tab</option></select></label></div>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 shrink-0" checked={forceOcr} onChange={(e) => setForceOcr(e.target.checked)} /><span>Use OCR for every PDF page (maximum 6), if embedded text is unreadable.</span></label>
      <button className="btn-primary" type="button" disabled={!file} onClick={extract}>Read selected file</button>
    </fieldset>}
    {busy && <p role="status" className="mt-4 break-words">{progress} Keep this page open. Import stops after 4 minutes.</p>}
    {source?.warnings.map((w) => <p key={w} className="mt-4 text-sm leading-6 text-muted">{w}</p>)}
    {source?.kind === "table" && !questions && <div className="mt-5 min-w-0 space-y-4">
      {source.workbook && <label className="block text-sm font-semibold">Worksheet<select aria-label="Worksheet" className="input-field mt-2" value={source.workbook.selected} onChange={(e) => chooseSheet(e.target.value)}>{source.workbook.sheets.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</select></label>}
      <p className="text-sm leading-6">{source.rows.length} source rows. Map your columns. Answers accept A–F, 1–6 or exact option text. Blank or ambiguous keys require manual review.</p>
      <div className="grid gap-4 sm:grid-cols-2">{TABLE_FIELDS.map((field) => <label key={field} className="text-sm font-semibold">{field}<select aria-label={`Map ${field}`} className="input-field mt-2" value={mapping[field] ?? -1} onChange={(e) => setMapping({ ...mapping, [field]: Number(e.target.value) })}><option value={-1}>Not supplied</option>{source.headers.map((h, i) => <option value={i} key={i}>{h}</option>)}</select></label>)}</div>
      <details><summary className="cursor-pointer text-sm underline">Preview first 5 source rows</summary><div className="mt-3 max-h-64 overflow-auto rounded-xl border border-line"><table className="text-sm"><thead><tr>{source.headers.map((h) => <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{source.rows.slice(0, 5).map((r) => <tr key={r.row}>{r.values.map((v, i) => <td className="max-w-64 break-words p-2" key={i}>{v}</td>)}</tr>)}</tbody></table></div></details>
      <button className="btn-primary" type="button" onClick={detect}>Review mapped questions</button>
    </div>}
    {questions && <div className="mt-5 min-w-0 space-y-5">
      {source?.kind === "pages" && <details><summary className="cursor-pointer text-sm underline">Correct extracted PDF text and detect again</summary><p className="mt-3 text-sm leading-6">Use numbered questions (1.), labelled options (A., B.), Answer: B and Explanation: …. Detecting again replaces this pending review. Pages retain their source/OCR warnings.</p><label className="mt-3 block">Source page<select aria-label="Source page" className="input-field mt-2" value={pageIndex} onChange={(e) => setPageIndex(Number(e.target.value))}>{source.pages.map((p, i) => <option key={p.page} value={i}>Page {p.page}</option>)}</select></label><textarea aria-label="Extracted page text" className="input-field mt-3" rows={10} maxLength={100000} value={source.pages[pageIndex].text} onChange={(e) => setSource({ ...source, pages: source.pages.map((p, i) => i === pageIndex ? { ...p, text: e.target.value, flags: [...new Set([...p.flags, "manual"])] } : p) })} /><button className="btn-secondary mt-3" type="button" onClick={async () => { if (!questions.length || await decide({ title: "Detect questions again?", body: "This replaces edits in the pending review with questions from the corrected extracted text. The assessment is unchanged.", confirmLabel: "Detect again", destructive: true })) detect(); }}>Detect again</button></details>}
      {!questions.length && <p role="status">No question boundaries detected. Correct the extracted text or add questions manually; no content was discarded from the source preview.</p>}
      <p role="status" className="text-sm leading-6">{questions.length} pending questions · {remaining} need review. Showing {questions.length ? currentChunk * 5 + 1 : 0}–{Math.min((currentChunk + 1) * 5, questions.length)} of {questions.length}.</p>
      {questions.slice(currentChunk * 5, currentChunk * 5 + 5).map((q, i) => { const index = currentChunk * 5 + i; return <AssessmentQuestionFields key={index} question={q} number={index + 1} prefix="Import " onChange={(next) => setQuestions((items) => items.map((v, n) => n === index ? next : v))} onRemove={async () => { if (await decide({ title: "Remove pending imported question?", body: "This removes it from the pending import only. Your assessment is unchanged.", confirmLabel: "Remove question", destructive: true })) setQuestions((items) => items.filter((_, n) => n !== index)); }} />; })}
      <div className="flex flex-wrap items-center gap-3"><button className="btn-secondary" type="button" disabled={currentChunk === 0} onClick={() => setChunk(currentChunk - 1)}>Previous 5 questions</button><span className="text-sm">Review page {currentChunk + 1}/{pages}</span><button className="btn-secondary" type="button" disabled={currentChunk + 1 >= pages} onClick={() => setChunk(currentChunk + 1)}>Next 5 questions</button><button className="btn-secondary" type="button" disabled={questions.length >= 40} onClick={() => { setQuestions([...questions, blankImportedQuestion()]); setChunk(Math.floor(questions.length / 5)); }}>Add manual imported question</button></div>
      <label className="block text-sm font-semibold">Apply import<select aria-label="Apply import" className="input-field mt-2" value={mode} onChange={(e) => setMode(e.target.value)}><option value="append">Append to {existingCount} existing questions</option><option value="replace">Replace {existingCount} existing questions</option></select></label>
      <p className="text-sm leading-6">Result: {total}/40 questions. {remaining > 0 && "Unreviewed questions can be saved in a draft; publishing is blocked until all are complete and checked."}</p>
      {total > 40 && <p role="alert" className="text-red-700 dark:text-red-300">This would exceed 40 questions. Remove questions or explicitly choose Replace. Nothing is truncated.</p>}
      <button className="btn-primary" type="button" disabled={!questions.length || total > 40} onClick={apply}>Add to assessment draft</button>
      <button className="btn-secondary ml-3" type="button" onClick={async () => { if (await decide({ title: "Return to import settings?", body: "This discards the pending review. Your assessment is unchanged.", confirmLabel: "Return to settings", destructive: true })) { setQuestions(null); setSource(null); } }}>Choose another file</button>
    </div>}
    {error && <p role="alert" className="mt-4 text-red-700 dark:text-red-300">{error}</p>}
    <button className="btn-secondary mt-5" type="button" onClick={close}>{busy ? "Cancel extraction" : "Close import"}</button>
  </section>;
}
