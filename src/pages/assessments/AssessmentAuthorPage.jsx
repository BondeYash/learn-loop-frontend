import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import { useDecision } from "../../components/DecisionProvider.jsx";
import WorkspaceIntro from "../../components/WorkspaceIntro.jsx";

import AssessmentQuestionFields from "../../components/AssessmentQuestionFields.jsx";
const QuestionImport = lazy(() => import("../../components/QuestionImport.jsx"));

const blankQuestion = () => ({ prompt: "", options: ["", ""], correctIndex: null, explanation: "", topic: "" });
function AssessmentEditor({ assessment, newKind, chapters, courseId, onSaved, onCancel }) {
  const initial = useMemo(() => assessment ? { title: assessment.title, kind: assessment.kind, module: assessment.moduleId, durationMinutes: assessment.durationMinutes, questions: assessment.questions } : { title: "", kind: newKind, module: newKind === "quiz" ? chapters[0]?._id || null : null, durationMinutes: newKind === "mock" ? 30 : null, questions: [] }, [assessment, newKind, chapters]);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const baseline = useRef(JSON.stringify(initial)), pending = useRef(false), decide = useDecision(), requestId = useRef(crypto.randomUUID()), action = useRef(null);
  useEffect(() => () => action.current?.abort(), []);
  const updateQuestion = (index, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  const save = async (status) => {
    if (pending.current || importOpen || status === "published" && form.questions.some((q) => q.importReview && !q.importReview.checked)) return; pending.current = true; setBusy(true); setError("");
    const controller = new AbortController(); action.current = controller;
    try {
      const path = `/courses/${courseId}/assessments${assessment ? `/${assessment.id}` : ""}`;
      const response = await axiosInstance({ method: assessment ? "put" : "post", url: path, signal: controller.signal, data: { ...form, status, ...(assessment ? { version: assessment.version } : { requestId: requestId.current }) } });
      if (!controller.signal.aborted) onSaved(response.data.data.assessment);
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); } finally { pending.current = false; if (!controller.signal.aborted) setBusy(false); }
  };
  const cancel = async () => {
    if (JSON.stringify(form) !== baseline.current && !await decide({ title: "Discard unsaved assessment changes?", body: "Saved drafts and submitted attempts are retained. These unsaved edits will be discarded.", confirmLabel: "Discard changes", destructive: true })) return;
    onCancel();
  };
  return <form className="card mt-6" onSubmit={(e) => { e.preventDefault(); save("published"); }}>
    <h2 className="text-2xl font-semibold">{assessment ? "Edit" : "Create"} {form.kind === "mock" ? "course mock test" : "chapter quiz"}</h2>
    <p className="mt-3 text-sm leading-7 text-muted">Save a draft to retain your work before leaving. Publishing requires complete questions, distinct options, a correct answer and an explanation. Existing attempts keep their original question version.</p>
    <fieldset disabled={busy || importOpen} className="mt-5 min-w-0 space-y-5">
      <label className="block text-sm font-semibold">Test title<input className="input-field mt-2" required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Assessment type<select aria-label="Assessment type" className="input-field mt-2" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, module: e.target.value === "quiz" ? chapters[0]?._id || null : null, durationMinutes: e.target.value === "mock" ? form.durationMinutes || 30 : form.durationMinutes })}><option value="quiz">Chapter quiz</option><option value="mock">Timed course mock test</option></select></label><label className="block text-sm font-semibold">Time limit in minutes {form.kind === "quiz" && "(optional)"}<input className="input-field mt-2" type="number" min={1} max={180} step={1} required={form.kind === "mock"} value={form.durationMinutes ?? ""} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value === "" ? null : Number(e.target.value) })} /></label></div>
      {form.kind === "quiz" && <label className="block text-sm font-semibold">Chapter<select aria-label="Chapter" className="input-field mt-2" required value={form.module || ""} onChange={(e) => setForm({ ...form, module: e.target.value })}><option value="">Choose a chapter</option>{chapters.map((m) => <option key={m._id} value={m._id}>{m.title}</option>)}</select></label>}
      <p className="text-sm leading-6 text-muted">1 point per correct answer; 0 for incorrect or unanswered questions. No negative marking. Maximum 40 questions, 2–6 options each and a 180-minute timer.</p>
      {!form.questions.length && <p className="rounded-xl border border-line p-4 text-sm">No questions authored yet. Add your own reviewed questions below.</p>}
      {form.questions.map((q, i) => <AssessmentQuestionFields key={i} question={q} number={i + 1} onChange={(next) => updateQuestion(i, next)} onRemove={async () => { if (await decide({ title: "Remove this question?", body: "The saved assessment changes only after you save or publish. Existing attempts retain their questions.", confirmLabel: "Remove question", destructive: true })) setForm((f) => ({ ...f, questions: f.questions.filter((_, n) => n !== i) })); }} />)}
      <button className="btn-secondary" type="button" disabled={form.questions.length >= 40} onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>Add question</button>
    </fieldset>
    <button className="btn-secondary mt-5" type="button" disabled={busy || importOpen} onClick={() => setImportOpen(true)}>Import PDF, Excel or CSV</button>
    {importOpen && <Suspense fallback={<p role="status" className="mt-4">Loading question importer…</p>}><QuestionImport existingCount={form.questions.length} onClose={() => setImportOpen(false)} onApply={(questions, mode) => { setForm((f) => ({ ...f, questions: mode === "replace" ? questions : [...f.questions, ...questions] })); setImportOpen(false); setError(""); }} /></Suspense>}
    {form.questions.some((q) => q.importReview && !q.importReview.checked) && <p className="mt-4 text-sm leading-6">Imported questions need review before publishing. Complete each question and check its review box; Save draft retains your progress.</p>}
    {error && <p role="alert" className="mt-5 text-red-700 dark:text-red-300">{error}</p>}
    {busy && <p role="status" className="mt-5">Saving assessment…</p>}
    <div className="mt-6 flex flex-wrap gap-3"><button className="btn-secondary" type="button" disabled={busy || importOpen} onClick={() => save("draft")}>Save draft</button><button className="btn-primary" disabled={busy || importOpen || form.questions.some((q) => q.importReview && !q.importReview.checked)}>Publish {form.kind === "mock" ? "mock test" : "quiz"}</button><button className="btn-secondary" type="button" disabled={busy || importOpen} onClick={cancel}>{assessment ? "Back to tests" : "Cancel"}</button></div>
    {assessment?.status === "published" && <p className="mt-3 text-sm leading-6 text-muted">Saving as a draft stops new attempts until you publish again.</p>}
  </form>;
}
function CourseAssessmentAuthor({ id }) {
  const [course, setCourse] = useState(null), [chapters, setChapters] = useState([]), [assessments, setAssessments] = useState([]), [selected, setSelected] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async (signal) => {
    try { const [c, a] = await Promise.all([axiosInstance.get(`/courses/mine/${id}`, { signal }), axiosInstance.get(`/courses/${id}/assessments/manage`, { signal })]); if (signal?.aborted) return; setCourse(c.data.data.course); setChapters(c.data.data.modules); setAssessments(a.data.data.assessments); setError(""); } catch (e) { if (e.code !== "ERR_CANCELED") { setError(errorMessage(e)); if ([401, 403, 404, 410].includes(e.response?.status)) { setCourse(null); setChapters([]); setAssessments([]); setSelected(null); } } }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); setCourse(null); setChapters([]); setAssessments([]); setSelected(null); setNotice(""); setError(""); load(controller.signal); return () => controller.abort(); }, [load]);
  return <section><Link className="text-sm text-primary-700 underline dark:text-primary-300" to={`/instructor/courses/${id}/curriculum`}>← Course curriculum</Link><div className="mt-5"><WorkspaceIntro eyebrow="Apne sawaal, apni practice" title="Mock tests and quizzes">{course?.title || "Chapter quizzes and timed course mock tests"}</WorkspaceIntro></div>
    {error && <div role="alert" className="card mt-5"><p className="text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-3" onClick={() => load()}>Reload assessments</button></div>}
    {notice && <p role="status" className="mt-5">{notice}</p>}
    {!course && !error && <p role="status" className="mt-5">Loading assessments…</p>}
    {course && <p className="card mt-5 text-sm leading-7">Publish a mock test to make it available to students who already have this course’s access. Publishing a test does not share the course or change enrollment/payment. {!course.isPublished && <><strong>This course is not shared yet.</strong> Use the <Link className="underline" to={`/instructor/courses/${id}/curriculum`}>course curriculum</Link> to prepare materials and choose students.</>}</p>}
    {course && selected !== null ? <AssessmentEditor key={typeof selected === "string" ? selected : `${selected.id}:${selected.version}`} assessment={typeof selected === "string" ? null : selected} newKind={selected === "new-quiz" ? "quiz" : "mock"} chapters={chapters} courseId={id} onCancel={() => { setSelected(null); load(); }} onSaved={(a) => { setSelected(a); setAssessments((items) => [...items.filter((item) => item.id !== a.id), a]); setNotice(a.status === "published" ? "Test published. Students with course access can start it." : "Draft saved. Students cannot start new attempts on this draft."); }} /> : course && <><div className="mt-6 flex flex-wrap gap-3"><button className="btn-primary" disabled={assessments.length >= 40} onClick={() => { setSelected("new-mock"); setNotice(""); }}>Create mock test</button><button className="btn-secondary" disabled={assessments.length >= 40 || !chapters.length} onClick={() => { setSelected("new-quiz"); setNotice(""); }}>Create chapter quiz</button></div>{!chapters.length && <p className="mt-3 text-sm text-muted">Chapter quizzes need a chapter in the curriculum. A course mock test does not.</p>}{!assessments.length && <p className="card mt-5">No assessments authored yet.</p>}{["mock", "quiz"].map((kind) => <section className="mt-7" key={kind}><h2 className="text-2xl font-semibold">{kind === "mock" ? "Course mock tests" : "Chapter quizzes"}</h2>{!assessments.some((a) => a.kind === kind) && <p className="card mt-4">{kind === "mock" ? "No mock tests authored yet. Create one, add your questions and publish when ready." : "No chapter quizzes authored yet."}</p>}<div className="mt-5 grid gap-5 md:grid-cols-2">{assessments.filter((a) => a.kind === kind).map((a) => <article className="card min-w-0" key={a.id}><p className="eyebrow">{a.status === "published" ? "Published — students with course access can start" : "Draft — students cannot start"}</p><h3 className="mt-3 break-words text-xl font-semibold">{a.title}</h3><p className="mt-3 text-sm text-muted">{a.questions.length} questions · {a.durationMinutes ? `${a.durationMinutes} minutes` : "Untimed"} · Version {a.version}</p><button className="btn-secondary mt-5" onClick={() => { setSelected(a); setNotice(""); }}>Edit {a.title}</button></article>)}</div></section>)}</>}

  </section>;
}
export default function AssessmentAuthorPage() { const { id } = useParams(); return <CourseAssessmentAuthor key={id} id={id} />; }
