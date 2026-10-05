import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import { useDecision } from "../../components/DecisionProvider.jsx";
import WorkspaceIntro from "../../components/WorkspaceIntro.jsx";

const blankQuestion = () => ({ prompt: "", options: ["", ""], correctIndex: null, explanation: "", topic: "" });
function AssessmentEditor({ assessment, chapters, courseId, onSaved, onCancel }) {
  const initial = useMemo(() => assessment ? { title: assessment.title, kind: assessment.kind, module: assessment.moduleId, durationMinutes: assessment.durationMinutes, questions: assessment.questions } : { title: "", kind: "quiz", module: chapters[0]?._id || null, durationMinutes: null, questions: [] }, [assessment, chapters]);
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const baseline = useRef(JSON.stringify(initial)), pending = useRef(false), decide = useDecision();
  const updateQuestion = (index, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  const save = async (status) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    try {
      const path = `/courses/${courseId}/assessments${assessment ? `/${assessment.id}` : ""}`;
      const response = await axiosInstance({ method: assessment ? "put" : "post", url: path, data: { ...form, status, ...(assessment ? { version: assessment.version } : {}) } });
      onSaved(response.data.data.assessment);
    } catch (e) { setError(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  };
  const cancel = async () => {
    if (JSON.stringify(form) !== baseline.current && !await decide({ title: "Discard unsaved assessment changes?", body: "Saved drafts and submitted attempts are retained. These unsaved edits will be discarded.", confirmLabel: "Discard changes", destructive: true })) return;
    onCancel();
  };
  return <form className="card mt-6" onSubmit={(e) => { e.preventDefault(); save("published"); }}>
    <h2 className="text-2xl font-semibold">{assessment ? "Edit assessment" : "Author an assessment"}</h2>
    <p className="mt-3 text-sm leading-7 text-muted">Save a draft to retain your work before leaving. Publishing requires complete questions, distinct options, a correct answer and an explanation. Existing attempts keep their original question version.</p>
    <fieldset disabled={busy} className="mt-5 min-w-0 space-y-5">
      <label className="block text-sm font-semibold">Assessment title<input className="input-field mt-2" required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Assessment type<select aria-label="Assessment type" className="input-field mt-2" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, module: e.target.value === "quiz" ? chapters[0]?._id || null : null, durationMinutes: e.target.value === "mock" ? form.durationMinutes || 30 : form.durationMinutes })}><option value="quiz">Chapter quiz</option><option value="mock">Timed course mock test</option></select></label><label className="block text-sm font-semibold">Time limit in minutes {form.kind === "quiz" && "(optional)"}<input className="input-field mt-2" type="number" min={1} max={180} step={1} required={form.kind === "mock"} value={form.durationMinutes ?? ""} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === "" ? null : Number(e.target.value) })} /></label></div>
      {form.kind === "quiz" && <label className="block text-sm font-semibold">Chapter<select aria-label="Chapter" className="input-field mt-2" required value={form.module || ""} onChange={(e) => setForm({ ...form, module: e.target.value })}><option value="">Choose a chapter</option>{chapters.map((m) => <option key={m._id} value={m._id}>{m.title}</option>)}</select></label>}
      <p className="text-sm leading-6 text-muted">1 point per correct answer; 0 for incorrect or unanswered questions. No negative marking. Maximum 40 questions, 2–6 options each and a 180-minute timer.</p>
      {!form.questions.length && <p className="rounded-xl border border-line p-4 text-sm">No questions authored yet. Add your own reviewed questions below.</p>}
      {form.questions.map((q, i) => <fieldset key={i} className="min-w-0 rounded-2xl border border-line p-4 sm:p-5"><legend className="px-2 font-semibold">Question {i + 1}</legend>
        <label className="block text-sm font-semibold">Question text {i + 1}<textarea aria-label={`Question text ${i + 1}`} className="input-field mt-2" rows={3} maxLength={1200} value={q.prompt} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} /></label>
        <div className="mt-4 space-y-3">{q.options.map((option, o) => <div className="flex items-end gap-2" key={o}><label className="min-w-0 flex-1 text-sm font-semibold">Question {i + 1}, option {o + 1}<input aria-label={`Question ${i + 1}, option ${o + 1}`} className="input-field mt-2" maxLength={400} value={option} onChange={(e) => updateQuestion(i, { options: q.options.map((v, n) => n === o ? e.target.value : v) })} /></label><button className="btn-secondary !px-3" type="button" disabled={q.options.length <= 2} aria-label={`Remove question ${i + 1} option ${o + 1}`} onClick={() => updateQuestion(i, { options: q.options.filter((_, n) => n !== o), correctIndex: q.correctIndex === o ? null : q.correctIndex > o ? q.correctIndex - 1 : q.correctIndex })}>×</button></div>)}</div>
        <button className="btn-secondary mt-3" type="button" disabled={q.options.length >= 6} onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>Add option to question {i + 1}</button>
        <label className="mt-4 block text-sm font-semibold">Correct answer for question {i + 1}<select aria-label={`Correct answer for question ${i + 1}`} className="input-field mt-2" value={q.correctIndex ?? ""} onChange={(e) => updateQuestion(i, { correctIndex: e.target.value === "" ? null : Number(e.target.value) })}><option value="">Choose the correct option</option>{q.options.map((_, o) => <option key={o} value={o}>Option {o + 1}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">Explanation for question {i + 1}<textarea aria-label={`Explanation for question ${i + 1}`} className="input-field mt-2" rows={3} maxLength={2000} value={q.explanation} onChange={(e) => updateQuestion(i, { explanation: e.target.value })} /></label>
        <label className="mt-4 block text-sm font-semibold">Topic tag for question {i + 1} (optional)<input aria-label={`Topic tag for question ${i + 1} (optional)`} className="input-field mt-2" maxLength={80} value={q.topic} onChange={(e) => updateQuestion(i, { topic: e.target.value })} /><span className="mt-2 block font-normal leading-6 text-muted">Use consistent author-defined tags to group practice results.</span></label>
        <button className="btn-danger mt-4" type="button" onClick={async () => { if (await decide({ title: "Remove this question?", body: "The saved assessment changes only after you save or publish. Existing attempts retain their questions.", confirmLabel: "Remove question", destructive: true })) setForm((f) => ({ ...f, questions: f.questions.filter((_, n) => n !== i) })); }}>Remove question {i + 1}</button>
      </fieldset>)}
      <button className="btn-secondary" type="button" disabled={form.questions.length >= 40} onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>Add question</button>
    </fieldset>
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {busy && <p role="status" className="mt-5">Saving assessment…</p>}
    <div className="mt-6 flex flex-wrap gap-3"><button className="btn-secondary" type="button" disabled={busy} onClick={() => save("draft")}>Save draft</button><button className="btn-primary" disabled={busy}>Publish assessment</button><button className="btn-secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
    {assessment?.status === "published" && <p className="mt-3 text-sm leading-6 text-muted">Saving as a draft stops new attempts until you publish again.</p>}
  </form>;
}
export default function AssessmentAuthorPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null), [chapters, setChapters] = useState([]), [assessments, setAssessments] = useState([]), [selected, setSelected] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async (signal) => {
    try { const [c, a] = await Promise.all([axiosInstance.get(`/courses/mine/${id}`, { signal }), axiosInstance.get(`/courses/${id}/assessments/manage`, { signal })]); if (signal?.aborted) return; setCourse(c.data.data.course); setChapters(c.data.data.modules); setAssessments(a.data.data.assessments); setError(""); } catch (e) { if (e.code !== "ERR_CANCELED") setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  return <section><Link className="text-sm text-primary-700 underline dark:text-primary-300" to={`/instructor/courses/${id}/curriculum`}>← Course curriculum</Link><div className="mt-5"><WorkspaceIntro eyebrow="Apne sawaal, apni practice" title="Assessments">{course?.title || "Chapter quizzes and timed course mock tests"}</WorkspaceIntro></div>
    {error && <div role="alert" className="card mt-5"><p className="text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-3" onClick={() => load()}>Reload assessments</button></div>}
    {notice && <p role="status" className="mt-5">{notice}</p>}
    {!course && !error && <p role="status" className="mt-5">Loading assessments…</p>}
    {course && selected !== null ? <AssessmentEditor key={selected === "new" ? "new" : `${selected.id}:${selected.version}`} assessment={selected === "new" ? null : selected} chapters={chapters} courseId={id} onCancel={() => setSelected(null)} onSaved={(a) => { setSelected(a); setAssessments((items) => [...items.filter((item) => item.id !== a.id), a]); setNotice(a.status === "published" ? "Assessment published. New attempts use this version." : "Draft saved. Students cannot start new attempts on this draft."); }} /> : course && <><button className="btn-primary mt-6" disabled={assessments.length >= 40} onClick={() => { setSelected("new"); setNotice(""); }}>Create assessment</button>{!assessments.length && <p className="card mt-5">No assessments authored yet.</p>}<div className="mt-5 grid gap-5 md:grid-cols-2">{assessments.map((a) => <article className="card min-w-0" key={a.id}><p className="eyebrow">{a.kind === "quiz" ? "Chapter quiz" : "Course mock test"} · {a.status}</p><h2 className="mt-3 break-words text-xl font-semibold">{a.title}</h2><p className="mt-3 text-sm text-muted">{a.questions.length} questions · {a.durationMinutes ? `${a.durationMinutes} minutes` : "Untimed"} · Version {a.version}</p><button className="btn-secondary mt-5" onClick={() => { setSelected(a); setNotice(""); }}>Edit {a.title}</button></article>)}</div></>}
  </section>;
}
