import { useCallback, useEffect, useRef, useState } from "react";
import { useDecision } from "./DecisionProvider.jsx";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";

export default function CourseNotes({ courseId, management = false, onChanged }) {
  const decide = useDecision();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef(null);
  const uploadId = useRef(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setNotes((await axiosInstance.get(`/courses/${courseId}/notes`)).data.data.notes); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);
  const choose = (event) => {
    const next = event.target.files?.[0]; setError(""); setNotice(""); setFile(null);
    if (!next) return;
    if (!/\.pdf$/i.test(next.name) || !next.size || next.size > 10 * 1024 * 1024) { setError("Choose a PDF file up to 10 MB."); event.target.value = ""; return; }
    uploadId.current = crypto.randomUUID(); setFile(next);
  };
  const upload = async (event) => {
    event.preventDefault(); if (!file || busy) return;
    setBusy(true); setError(""); setNotice(""); setProgress(0);
    const body = new FormData(); body.append("uploadId", uploadId.current); body.append("file", file);
    try {
      await axiosInstance.post(`/courses/${courseId}/notes`, body, { headers: { "Content-Type": undefined }, timeout: 90000, onUploadProgress: (event) => setProgress(Math.round(event.loaded / (event.total || file.size) * 100)) });
      setFile(null); input.current.value = ""; setNotice("PDF added to course notes."); await onChanged?.();
    } catch (e) { setError(`${errorMessage(e)} Your selected file is kept so you can retry.`); }
    finally { await load(); setBusy(false); }
  };
  const open = async (note, download) => {
    setError("");
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setError("Allow a new tab for this site, then try opening the PDF again."); return; }
    tab.opener = null;
    try {
      const { data } = await axiosInstance.get(`/courses/${courseId}/notes/${note.id}/url`, { params: { download } });
      const url = new URL(data.data.url);
      if (url.protocol !== "https:" && url.origin !== window.location.origin) throw new Error("The PDF link is unavailable. Try again.");
      tab.location.replace(url.href);
    } catch (e) { tab.close(); setError(errorMessage(e)); }
  };
  const remove = async (note) => {
    if (await decide({ title: "Remove this PDF?", body: `“${note.filename}” will be removed from this course. Students will lose access to this handout.`, destructive: true, confirmLabel: "Remove PDF", onConfirm: () => axiosInstance.delete(`/courses/${courseId}/notes/${note.id}`) })) { setNotice("PDF removed."); await onChanged?.(); await load(); }
  };
  return <section className="card mt-8" aria-labelledby="course-notes-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="course-notes-title" className="text-xl font-semibold">Course notes</h2><button className="btn-secondary text-xs" disabled={loading || busy} onClick={() => { setError(""); load(); }}>Refresh notes</button></div>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{management ? "Add PDF handouts for your assigned students. Up to 20 files, 10 MB each. Use unencrypted PDFs without scripts or embedded files." : "Open or download the PDF handouts for this course."}</p>
    {management && <form className="mt-5 space-y-3" onSubmit={upload}><label className="block text-sm font-medium">PDF course note<input ref={input} type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-sm" onChange={choose} disabled={busy} /></label><button type="submit" className="btn-primary" disabled={busy || !file}>{busy ? progress >= 100 ? "Checking PDF…" : "Uploading…" : "Upload PDF"}</button>{busy && file && <div><progress aria-label="PDF upload progress" className="w-full" value={progress} max={100} /><p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">{progress >= 100 ? "Checking the PDF and confirming private storage…" : `Uploading ${progress}%…`} Keep this page open.</p></div>}</form>}
    {error && <p role="alert" className="mt-4 break-words text-sm text-red-700 dark:text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {loading && !notes.length ? <p className="mt-4 text-sm" role="status">Loading notes…</p> : <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-700">{notes.map((note) => <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-[1_1_180px]"><h3 className="break-all text-sm font-medium">{note.filename}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{(note.size / 1048576).toFixed(1)} MB · {note.pages || "—"} pages{note.status !== "ready" ? ` · ${note.status === "failed" ? "Upload needs retry" : note.status === "removing" ? "Removal needs retry" : "Upload in progress"}` : ""}</p></div><div className="flex flex-wrap gap-3">{note.status === "ready" && <><button className="btn-secondary text-xs" onClick={() => open(note, false)} aria-label={`Open ${note.filename}`}>Open PDF</button><button className="btn-secondary text-xs" onClick={() => open(note, true)} aria-label={`Download ${note.filename}`}>Download</button></>}{management && <button disabled={busy} className="text-xs text-red-700 underline dark:text-red-300" onClick={() => remove(note)} aria-label={`Remove ${note.filename}`}>Remove</button>}</div></li>)}</ul>}
    {!loading && !notes.length && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No PDF notes yet.</p>}
  </section>;
}
