import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { clearAttribution, getAttribution, saveAttribution } from "../services/acquisition.js";
import { useDecision } from "./DecisionProvider.jsx";
const empty = () => ({ email: "", purpose: "interest", contactAcknowledged: false, marketingConsent: false });
function InterestForm({ courseId, options }) {
  const [open, setOpen] = useState(false), [form, setForm] = useState(empty), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const pending = useRef(false), attempt = useRef(null), action = useRef(null), decide = useDecision();
  useEffect(() => () => action.current?.abort(), []);
  const cancel = async () => { if ((form.email || form.contactAcknowledged || form.marketingConsent) && !await decide({ title: "Discard unsent interest request?", body: "Your email and choices have not been saved. Discard these unsent details?", confirmLabel: "Discard request", destructive: true })) return; setOpen(false); setForm(empty()); setError(""); };
  if (saved) return <p className="mt-5 text-sm leading-6" role="status">Your request is saved for the course team. A response is not guaranteed. You can still use the sample and enroll independently.</p>;
  if (!open) return <button className="btn-secondary mt-5 w-full" onClick={() => setOpen(true)}>Request course information or a demo</button>;
  return <form className="mt-5" onSubmit={async (event) => { event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError(""); const request = new AbortController(); action.current = request;
    const signature = JSON.stringify(form); if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    try { await axiosInstance.post(`/public/courses/${courseId}/interest`, { ...form, requestId: attempt.current.id }, { signal: request.signal }); if (!request.signal.aborted) { setSaved(true); setForm(empty()); } }
    catch (e) { if (!request.signal.aborted) setError(errorMessage(e)); } finally { pending.current = false; if (!request.signal.aborted) setBusy(false); }
  }}><h2 className="font-semibold">Ask the course team</h2><p className="mt-2 text-sm leading-6 text-muted">Share an email for a response to this request. This does not enroll you or reserve a demo. Details expire after {options.retentionDays} days.</p>
    <fieldset disabled={busy} className="mt-4 min-w-0 space-y-3"><label className="block text-sm font-semibold">Your email<input className="input-field mt-2" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label className="block text-sm font-semibold">Request type<select aria-label="Request type" className="input-field mt-2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}><option value="interest">Course information</option><option value="demo">Demo information</option></select></label>
      <label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" required checked={form.contactAcknowledged} onChange={(e) => setForm({ ...form, contactAcknowledged: e.target.checked })} />I allow the course team to use my email to respond to this request.</label>
      <label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })} />Optional: I also agree to ongoing course marketing emails from this team.</label>
    </fieldset><a href={options.policyUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">Read the course privacy notice</a>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="mt-4 flex flex-wrap gap-3"><button className="btn-primary" disabled={busy}>{busy ? "Saving request…" : "Save interest request"}</button><button className="btn-secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
  </form>;
}
export default function CourseAcquisition({ courseId }) {
  const location = useLocation(), user = useSelector((s) => s.auth.user);
  const [options, setOptions] = useState(null), [consent, setConsent] = useState(Boolean(getAttribution(courseId))), [message, setMessage] = useState(""), [retry, setRetry] = useState(0), [eraseError, setEraseError] = useState(false);
  const visitId = useRef(crypto.randomUUID()), visit = useRef(null), visited = useRef(false), source = useRef(new URLSearchParams(location.search).get("source") || ""), action = useRef(null);
  useEffect(() => { const request = new AbortController(); axiosInstance.get(`/public/courses/${courseId}/acquisition`, { signal: request.signal }).then((r) => { if (!request.signal.aborted) setOptions(r.data.data); }).catch(() => { /* Optional; enrollment and samples stay available. */ }); return () => { request.abort(); action.current?.abort(); }; }, [courseId]);
  useEffect(() => {
    if (!consent || !options?.measurementEnabled || visited.current) return;
    const request = new AbortController(); visit.current = request;
    axiosInstance.post(`/public/courses/${courseId}/visits`, { consent: true, sourceCode: getAttribution(courseId)?.sourceCode || "", requestId: visitId.current }, { signal: request.signal }).then(() => { if (!request.signal.aborted) { visited.current = true; setMessage("Optional measurement is enabled for this course in this tab for up to 24 hours."); } }).catch((e) => { if (!request.signal.aborted) setMessage(errorMessage(e)); });
    return () => request.abort();
  }, [courseId, consent, options, retry]);
  const withdraw = async () => { visit.current?.abort(); clearAttribution(courseId); setConsent(false); setMessage("Optional measurement is off. Earlier anonymous views expire automatically."); setEraseError(false); if (user?.role === "student") { const request = new AbortController(); action.current?.abort(); action.current = request; try { await axiosInstance.delete(`/courses/${courseId}/acquisition/choice`, { signal: request.signal }); } catch (e) { if (!request.signal.aborted) { setEraseError(true); setMessage(`Measurement is off in this tab. Your saved account source could not be removed: ${errorMessage(e)}`); } } } };
  if (!options?.measurementEnabled && !options?.interestEnabled) return null;
  return <section className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700" aria-label="Optional course choices">
    {options.measurementEnabled && navigator.globalPrivacyControl !== true && <><label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={consent} onChange={(e) => {
      if (e.target.checked) { const stored = saveAttribution(courseId, source.current); setConsent(stored); if (!stored) setMessage("Optional measurement could not be enabled because tab storage is unavailable."); }
      else withdraw();
    }} />Optional: count this page view and save the source of my enrollment for this course.</label><p className="mt-2 text-xs leading-5 text-muted">No advertising trackers or visitor fingerprint. Counts are not unique people. Server records expire after {options.retentionDays} days. You can switch this off here.</p><a href={options.policyUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">Measurement privacy notice</a>{message && <p role="status" className="mt-3 text-sm leading-6">{message}</p>}{consent && !visited.current && message && <button className="btn-secondary mt-3" onClick={() => setRetry((v) => v + 1)}>Retry optional measurement</button>}{eraseError && <button className="btn-secondary mt-3" onClick={withdraw}>Retry removing saved source</button>}</>}
    {options.interestEnabled && <InterestForm key={courseId} courseId={courseId} options={options} />}
  </section>;
}
