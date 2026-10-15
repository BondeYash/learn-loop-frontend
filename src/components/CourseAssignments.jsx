import { Button } from "./Action.jsx";
import { useCallback, useEffect, useState } from "react";
import { useDecision } from "./DecisionProvider.jsx";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";

export default function CourseAssignments({ courseId, published, price = 0, onChanged }) {
  const decide = useDecision();
  const [assignments, setAssignments] = useState([]);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const paidCourse = price > 0;
  const load = useCallback(async () => {
    try { setAssignments((await axiosInstance.get(`/courses/${courseId}/assignments`)).data.data.assignments); setError(""); }
    catch (e) { setError(errorMessage(e)); }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);
  const assign = async (selectedEmails, clearInput = false) => {
    setBusy(true); setMessage(""); setError("");
    try {
      const { data } = await axiosInstance.post(`/courses/${courseId}/assignments`, { emails: selectedEmails, makeAvailable: true, waivePayment: paidCourse });
      if (clearInput) setEmails("");
      setMessage(data.message); await load(); await onChanged?.();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const remove = async (item) => {
    if (await decide({
      title: "Remove instructor assignment?",
      body: `${item.student.name} will lose this instructor assignment${item.paymentWaivedAt ? " and its free access" : ""}. ${paidCourse ? "They will need a valid payment to open this course. " : ""}Existing purchases and learning progress are preserved.`,
      destructive: true, confirmLabel: "Remove assignment",
      onConfirm: () => axiosInstance.delete(`/courses/${courseId}/assignments/${item.student._id}`),
    })) { await load(); setMessage("Instructor assignment and any free access removed. Existing purchases are preserved."); }
  };
  return <section id="assign-students" className="card mt-8 scroll-mt-24">
    <h2 className="text-xl font-bold">{paidCourse ? "Grant free course access" : "Assign students"}</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{paidCourse ? "Choose students who can learn without paying. Only the registered email addresses you enter get free access to this course’s lessons, notes and published mock tests. Other students can still buy the course normally." : "Enter registered student email addresses, separated by commas or new lines, to give them access to this course."}</p>
    {!published && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This also publishes the course. Finish any video uploads before granting access.</p>}
    <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); assign(emails.split(/[\s,;]+/).filter(Boolean), true); }}>
      <label className="block text-sm font-medium">Student email addresses<textarea required disabled={busy} className="input-field mt-1 min-h-24" value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="student@example.com" /></label>
      <Button className="btn-primary" disabled={busy}>{busy ? "Saving…" : paidCourse ? "Grant free access" : "Assign course"}</Button>
    </form>
    {error && <div className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}<Button className="ml-3 underline" disabled={busy} onClick={load}>Reload assignments</Button></div>}
    {message && <p className="mt-3 text-sm text-success-600 dark:text-emerald-300" role="status">{message}</p>}
    <ul className="mt-5 divide-y divide-slate-200 dark:divide-slate-700">{assignments.filter((item) => item.student).map((item) => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item._id}>
      <div className="min-w-0"><p className="font-medium">{item.student.name}</p><p className="break-words text-sm text-slate-500 dark:text-slate-400">{item.student.email} · {item.status}</p>{paidCourse && <p className="mt-1 text-sm text-primary-700 dark:text-primary-200">{item.paymentWaivedAt ? "Free access granted" : "Payment applies · no free access granted"}</p>}</div>
      <div className="flex flex-wrap items-center gap-3">{paidCourse && !item.paymentWaivedAt && <Button disabled={busy} className="btn-secondary" onClick={() => assign([item.student.email])}>Grant free access</Button>}<Button disabled={busy} className="text-sm text-red-700 dark:text-red-300 underline" onClick={() => remove(item)}>Remove assignment</Button></div>
    </li>)}</ul>
    {!assignments.length && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No students assigned yet.</p>}
  </section>;
}
