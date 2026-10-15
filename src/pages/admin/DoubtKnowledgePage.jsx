import { Button, BackLink } from "../../components/Action.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, RefreshCw, Sparkles, Upload } from "lucide-react";
import resilientGet from "../../services/resilientGet.js";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import DoubtChat from "../../components/DoubtChat.jsx";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import WorkspaceIntro from "../../components/WorkspaceIntro.jsx";
import { useDecision } from "../../components/DecisionProvider.jsx";
const EMPTY_TURNS = [];
const fields = [["monthlyAnswers", "Answers per month", 10000], ["dailyAnswers", "Answers per student per day", 200], ["monthlyPages", "PDF pages indexed per month", 10000], ["storageMb", "PDF storage allowance (MB)", 1000], ["courseDocuments", "PDFs per course", 1000]];
function Budget({ data, saved }) {
  const [settings, setSettings] = useState(data.settings), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <form className="card" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await axiosInstance.put("/admin/doubt-dost/settings", settings); await saved(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}><h2 className="text-xl font-semibold">Usage controls</h2><p className="mt-3 text-sm leading-7 text-muted">Start small and adjust as students use the assistant. Failed AI requests and admin previews also use allowances.</p><fieldset disabled={busy} className="mt-4 min-w-0 space-y-4"><label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />Allow AI answers and new indexing</label>{fields.map(([key, label, max]) => <label className="block text-sm font-medium" key={key}>{label}<input type="number" required min={1} max={max} step={1} className="input-field mt-2" value={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.value === "" ? "" : Number(e.target.value) })} /></label>)}</fieldset>{error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}<Button disabled={busy} className="btn-primary mt-5">{busy ? "Saving…" : "Save usage controls"}</Button><p className="mt-4 text-xs leading-6 text-muted">Allowances bound requests, pages and storage; they are not a guaranteed currency spending cap. Google bills API usage separately. Daily and monthly allowances reset at midnight in India.</p></form>;
}
export default function DoubtKnowledgePage() {
  const [params, setParams] = useSearchParams(), course = params.get("course") || "";
  const [data, setData] = useState(null), [library, setLibrary] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [page, setPage] = useState(1);
  const [queue, setQueue] = useState([]), [uploading, setUploading] = useState(false), [busy, setBusy] = useState(null), [activity, setActivity] = useState(null), [helpOnly, setHelpOnly] = useState(true), [activityPage, setActivityPage] = useState(1);
  const activityGeneration = useRef(0);
  const generation = useRef(0), uploadController = useRef(null), input = useRef(null), decide = useDecision();
  const overview = useCallback(async () => { const result = await resilientGet("/admin/doubt-dost"); setData(result.data.data); }, []);
  const load = useCallback(async () => {
    const version = ++generation.current;
    if (!course) { setLibrary(null); return; }
    try { const r = await resilientGet(`/admin/doubt-dost/courses/${course}/documents`, { params: { page } }); if (generation.current === version) { setLibrary(r.data.data); setError(""); } }
    catch (e) { if (generation.current === version) { setLibrary(null); setError(errorMessage(e)); } }
  }, [course, page]);
  const loadActivity = useCallback(async () => { const version = ++activityGeneration.current; try { const r = await resilientGet("/admin/doubt-dost/activity", { params: { page: activityPage, needsHelp: helpOnly, courseId: course || undefined } }); if (version === activityGeneration.current) setActivity(r.data.data); } catch (e) { if (version === activityGeneration.current) setError(errorMessage(e)); } }, [course, activityPage, helpOnly]);
  useEffect(() => { void overview().catch(e => setError(errorMessage(e))); }, [overview]);
  useEffect(() => { setLibrary(null); void load(); const counter = generation; return () => { counter.current++; }; }, [load]);
  useEffect(() => { void loadActivity(); }, [loadActivity]);
  useEffect(() => () => uploadController.current?.abort(), []);
  const processing = library?.documents.some(doc => ["queued", "indexing", "removing", "uploading"].includes(doc.status));
  useEffect(() => { if (!processing) return; const timer = setInterval(() => { if (!document.hidden) { void load(); void overview().catch(() => {}); } }, 6000); return () => clearInterval(timer); }, [processing, load, overview]);
  const upload = async () => {
    if (uploading || !course) return;
    setUploading(true); setError("");
    const controller = new AbortController(); uploadController.current = controller;
    for (const item of queue.filter(item => item.status !== "received")) {
      if (controller.signal.aborted) break;
      const update = status => setQueue(items => items.map(entry => entry.id === item.id ? { ...entry, ...status } : entry));
      if (item.file.size > 10 * 1024 ** 2 || !/\.pdf$/i.test(item.file.name)) { update({ status: "failed", error: "Choose a PDF up to 10 MB." }); continue; }
      update({ status: "uploading", error: "" });
      const form = new FormData(); form.append("uploadId", item.id); form.append("file", item.file);
      try { await axiosInstance.post(`/admin/doubt-dost/courses/${course}/documents`, form, { signal: controller.signal, timeout: 90000, headers: { "Content-Type": undefined } }); update({ status: "received" }); }
      catch (e) { if (!controller.signal.aborted) update({ status: "failed", error: errorMessage(e) }); }
    }
    uploadController.current = null; setUploading(false); void load(); void overview().catch(() => {});
  };
  const action = async (doc, type) => {
    if (type === "remove" && !await decide({ title: "Remove this knowledge base PDF?", body: "It will stop supporting new student answers immediately. Stored copies will be removed in the background.", confirmLabel: "Remove PDF", destructive: true })) return;
    setBusy(doc.id); setError(""); setNotice("");
    try { if (type === "remove") await axiosInstance.delete(`/admin/doubt-dost/courses/${course}/documents/${doc.id}`); else await axiosInstance.put(`/admin/doubt-dost/courses/${course}/documents/${doc.id}`, { action: type }); setNotice(type === "publish" ? "PDF published to Doubt Dost." : type === "unpublish" ? "PDF hidden from student answers." : type === "retry" ? "Indexing queued again." : "PDF hidden; removal queued."); await load(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const indexed = Boolean(library?.indexedDocuments);
  return <section><BackLink  to="/admin">Administration</BackLink><div className="my-6"><WorkspaceIntro eyebrow="Sahi material se, sahi samajh" title="Doubt Dost knowledge base">Upload course PDFs, try a few doubts, and publish the material you want students to learn from.</WorkspaceIntro></div>
    {error && <div role="alert" className="card mb-5"><p>{error}</p><Button className="btn-secondary mt-3" onClick={() => { void overview().catch(e => setError(errorMessage(e))); void load(); void loadActivity(); }}>Reload workspace</Button></div>}
    {!data && !error && <LoadingSkeleton variant="detail" label="Loading knowledge base…" />}
    {data && <>{!data.configured && <div role="status" className="card mb-5"><h2 className="font-semibold">Connect the AI service</h2><p className="mt-2 text-sm leading-7 text-muted">Add GEMINI_API_KEY to the Render backend and redeploy. Uploaded PDFs will stay queued until the key is configured. Use a billing-enabled Google project for proprietary course materials.</p></div>}
      <div className="doubt-usage-strip mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Answers this month", `${data.usage.answers}/${data.settings.monthlyAnswers}`], ["PDF pages indexed", `${data.usage.pages}/${data.settings.monthlyPages}`], ["PDF storage", `${(data.usage.bytes / 1024 ** 2).toFixed(1)} MB`], ["AI model", data.model]].map(([label, value]) => <div className="card stat-card min-w-0 !p-4" key={label}><p className="text-xs text-muted">{label}</p><p className="mt-3 break-words text-lg font-semibold">{value}</p></div>)}</div>
      <div className="doubt-admin-grid"><div className="min-w-0"><section className="card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><BookOpen size={20} />Course PDFs</h2><Button className="btn-secondary gap-2" disabled={uploading} onClick={() => { void load(); void overview().catch(e => setError(errorMessage(e))); void loadActivity(); }}><RefreshCw size={15} />Refresh</Button></div><label className="mt-5 block text-sm font-semibold">Course<select aria-label="Knowledge base course" disabled={uploading} className="input-field mt-2" value={course} onChange={e => { setPage(1); setActivityPage(1); setQueue([]); setNotice(""); setParams(e.target.value ? { course: e.target.value } : {}); }}><option value="">Choose a course</option>{data.courses.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
        {course && <><label className="mt-5 block text-sm font-semibold">PDFs to add<input ref={input} aria-label="Knowledge base PDFs" type="file" multiple accept=".pdf,application/pdf" disabled={uploading} className="mt-3 block w-full min-w-0 text-sm" onChange={e => { setQueue([...e.target.files].map(file => ({ file, id: crypto.randomUUID(), status: "selected" }))); }} /></label><p className="mt-3 text-xs leading-6 text-muted">Up to 10 MB and 500 pages per PDF. Files are uploaded one at a time and indexed in the background. Google processes these PDFs for AI answers; use a billing-enabled project for proprietary material. Publish only PDFs approved for student access; published sources can be opened by entitled students.</p>{queue.length > 0 && <ul className="mt-4 space-y-2" aria-label="Upload queue">{queue.map(item => <li className="break-words text-sm" key={item.id}>{item.file.name} · {item.status}{item.error && <p className="mt-1 text-red-700 dark:text-red-300">{item.error}</p>}</li>)}</ul>}<Button className="btn-primary mt-4 gap-2" disabled={uploading || !queue.some(item => item.status !== "received")} onClick={upload}><Upload size={16} />{uploading ? "Uploading PDFs…" : "Upload selected PDFs"}</Button></>}
        {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
        {course && !library && !error && <LoadingSkeleton label="Loading course PDFs…" />}
        {library && <><p className="mt-6 text-sm text-muted">{library.total} PDFs in this course’s knowledge base</p>{!library.documents.length && <p className="mt-5 text-sm leading-7">Add your first PDF to start. Try the indexed material in the preview before publishing it.</p>}{library.documents.map(doc => <article className="doubt-document" key={doc.id}><h3 className="doubt-document-title">{doc.filename}</h3><p className="mt-2 text-xs text-muted">{doc.pages} pages · {(doc.size / 1024 ** 2).toFixed(2)} MB</p><span className={`doubt-state ${doc.published ? "doubt-state-published" : ""}`}>{doc.published ? "Published to students" : doc.status === "ready" ? "Indexed draft" : doc.status}</span>{doc.error && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{doc.error}</p>}<div className="doubt-document-actions">{doc.status === "ready" && <Button className="btn-primary" disabled={busy === doc.id} onClick={() => action(doc, doc.published ? "unpublish" : "publish")}>{doc.published ? "Unpublish" : "Publish to Doubt Dost"}</Button>}{doc.status === "failed" && <Button className="btn-secondary" disabled={busy === doc.id} onClick={() => action(doc, "retry")}>Retry indexing</Button>}<Button className="btn-secondary" disabled={busy === doc.id} onClick={() => action(doc, "remove")}>{doc.status === "removing" ? "Retry removal" : "Remove PDF"}</Button></div></article>)}{library.total > 20 && <div className="mt-5 flex items-center justify-between gap-3"><Button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous PDFs</Button><span className="text-sm">Page {page}</span><Button className="btn-secondary" disabled={page * 20 >= library.total} onClick={() => setPage(page + 1)}>Next PDFs</Button></div>}</>}
      </section>{course && <section className="mt-6"><h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Sparkles size={20} />Try the course material</h2><DoubtChat key={course} courseId={course} preview onRefresh={async () => { await overview(); await loadActivity(); }} available={Boolean(data.configured && data.settings.enabled && indexed)} initialTurns={EMPTY_TURNS} /></section>}</div><Budget key={data.settings.updatedAt || "initial"} data={data} saved={async () => { await overview(); setNotice("Usage controls saved."); }} /></div>
      <section className="card mt-7"><h2 className="text-xl font-semibold">Doubts that need attention</h2><label className="mt-4 flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" checked={helpOnly} onChange={e => { setHelpOnly(e.target.checked); setActivityPage(1); }} />Show unanswered, failed or unhelpful doubts only</label>{activity?.turns.map(turn => <article key={turn.id} className="mt-4 border-t border-line pt-4"><p className="text-xs text-muted">{turn.courseTitle} · {turn.status}{turn.feedback ? ` · ${turn.feedback}` : ""}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{turn.question}</p></article>)}{activity?.turns.length === 0 && <p className="mt-4 text-sm text-muted">No doubts to show for this selection.</p>}{activity?.total > 20 && <div className="mt-5 flex flex-wrap gap-3"><Button className="btn-secondary" disabled={activityPage <= 1} onClick={() => setActivityPage(activityPage - 1)}>Previous doubts</Button><Button className="btn-secondary" disabled={activityPage * 20 >= activity.total} onClick={() => setActivityPage(activityPage + 1)}>Next doubts</Button></div>}</section>
    </>}
  </section>;
}
