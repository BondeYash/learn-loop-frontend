import { useCallback, useEffect, useState } from "react";
import { useDecision } from "./DecisionProvider.jsx";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
export default function CourseAssignments({ courseId, published, onChanged }) {
  const decide = useDecision();
  const [assignments, setAssignments] = useState([]);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setAssignments((await axiosInstance.get(`/courses/${courseId}/assignments`)).data.data.assignments); setError(""); } catch (e) { setError(errorMessage(e)); } }, [courseId]);
  useEffect(() => { load(); }, [load]);
  const assign = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try { const { data } = await axiosInstance.post(`/courses/${courseId}/assignments`, { emails: emails.split(/[\s,;]+/).filter(Boolean), makeAvailable: true }); setEmails(""); setMessage(data.message); await load(); await onChanged?.(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const remove = async (student) => {
    if (await decide({ title: "Remove course access?", body: `${student.name} will no longer have access to this course. Their learning records are preserved.`, destructive: true, confirmLabel: "Remove access", onConfirm: () => axiosInstance.delete(`/courses/${courseId}/assignments/${student._id}`) })) { await load(); setMessage("Course access removed."); }
  };
  return <section id="assign-students" className="card mt-8"><h2 className="text-xl font-bold">Assign students</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Enter registered student email addresses, separated by commas or new lines. Assigning shares this course with those students once its lessons or PDF notes are ready.</p>{!published && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Only assigned students will have access. Finish any video uploads before assigning.</p>}
    <form className="mt-4 space-y-3" onSubmit={assign}><label className="block text-sm font-medium">Student email addresses<textarea required className="input-field mt-1 min-h-24" value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="student@example.com" /></label><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Assign course"}</button></form>
    {error && <div className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}<button className="ml-3 underline" onClick={load}>Reload assignments</button></div>}{message && <p className="mt-3 text-sm text-success-600 dark:text-emerald-300" role="status">{message}</p>}
    <ul className="mt-5 divide-y divide-slate-200">{assignments.filter((item) => item.student).map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item._id}><div><p className="font-medium">{item.student.name}</p><p className="text-sm text-slate-500 dark:text-slate-400">{item.student.email} · {item.status}</p></div><button disabled={busy} className="text-sm text-red-700 dark:text-red-300 underline" onClick={() => remove(item.student)}>Remove access</button></li>)}</ul>{!assignments.length && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No students assigned yet.</p>}
  </section>;
}
