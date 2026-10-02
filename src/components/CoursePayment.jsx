import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { createCheckout, formatInr } from "../services/payments.js";
import { Link } from "react-router-dom";

export default function CoursePayment({ courseId, onAccess }) {
  const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const pending = useRef(false), controller = useRef(null), attempt = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    controller.current?.abort(); controller.current = new AbortController();
    try { const result = await axiosInstance.get(`/payments/courses/${courseId}/quote`, { signal: controller.current.signal }); setData(result.data.data); setError(""); }
    catch (e) { if (e.code !== "ERR_CANCELED") setError(errorMessage(e)); }
  }, [courseId]);
  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  const pay = async () => {
    if (pending.current || !data?.quote) return;
    pending.current = true; setBusy(true); setError("");
    try { const checkout = await createCheckout(courseId, data.quote.amountMinor, attempt.current); window.location.assign(checkout.url); }
    catch (e) { if (e.response?.status === 409) { attempt.current = crypto.randomUUID(); await load(); } setError(errorMessage(e)); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="card mt-5 max-w-2xl"><p className="eyebrow">Assigned course</p><h1 className="mt-3 text-2xl font-semibold">{data?.quote.title || "Payment required"}</h1><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">Your instructor has assigned this course. Payment is required before you can open its lessons and PDF notes.</p><p className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-200">Stripe test mode — no real money is charged.</p>{data?.quote && <p className="mt-5 text-3xl font-semibold">{formatInr(data.quote.amountMinor)}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
    {!data && !error && <p role="status" className="mt-4 text-sm">Loading course price…</p>}
    {data?.readiness.configured === false && <p className="mt-4 text-sm" role="status">Test checkout is being configured. Please try again later.</p>}
    <div className="mt-6 flex flex-wrap gap-3">{data?.quote && (data.quote.paid || !data.quote.requiresPayment) ? <button className="btn-primary" onClick={onAccess}>Open course</button> : data && <button className="btn-primary" disabled={busy || !data.readiness.configured} onClick={pay}>{busy ? "Opening Stripe…" : "Continue to test checkout"}</button>}<button className="btn-secondary" disabled={busy} onClick={load}>Refresh price</button>{data?.quote.pendingOrderId && <Link className="btn-secondary" to={`/payments/${data.quote.pendingOrderId}`}>Review payment attempt</Link>}</div>
  </section>;
}
