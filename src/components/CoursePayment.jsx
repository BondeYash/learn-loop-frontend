import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { createCheckout, formatInr } from "../services/payments.js";
import { Link } from "react-router-dom";
import { getAttribution } from "../services/acquisition.js";

export default function CoursePayment({ courseId, onAccess, publicEnrollment = false, compact = false }) {
  const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const pending = useRef(false), controller = useRef(null), action = useRef(null), attempt = useRef(crypto.randomUUID());
  const load = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    try { const result = await axiosInstance.get(`/payments/courses/${courseId}/quote`, { signal: request.signal }); if (!request.signal.aborted) { setData(result.data.data); setError(""); } }
    catch (e) { if (!request.signal.aborted) setError(errorMessage(e)); }
  }, [courseId]);
  useEffect(() => { load(); return () => { controller.current?.abort(); action.current?.abort(); }; }, [load]);
  const execute = async (enroll) => {
    if (pending.current || !data?.quote) return;
    pending.current = true; setBusy(true); setError("");
    const request = new AbortController(); action.current = request;
    try {
      if (enroll) {
        const attribution = getAttribution(courseId);
        await axiosInstance.post(`/courses/${courseId}/enroll`, { quotedAmountMinor: data.quote.amountMinor, ...(attribution ? { attribution } : {}) }, { signal: request.signal });
        if (!request.signal.aborted) onAccess();
      } else {
        const checkout = await createCheckout(courseId, data.quote.amountMinor, attempt.current, data.quote.testMode, request.signal);
        if (!request.signal.aborted) window.location.assign(checkout.url);
      }
    } catch (e) {
      if (!request.signal.aborted) { if (e.response?.status === 409) { attempt.current = crypto.randomUUID(); await load(); } setError(errorMessage(e)); }
    } finally { pending.current = false; if (!request.signal.aborted) setBusy(false); }
  };
  const quote = data?.quote, isPublic = publicEnrollment || quote?.enrollmentType === "public";
  const validMode = typeof quote?.testMode === "boolean" && data?.readiness?.testMode === quote.testMode;
  const needsPayment = quote?.requiresPayment === true;
  const isFree = quote?.amountMinor === 0 && !needsPayment;
  const needsEnrollment = isPublic && quote?.enrollmentRequired === true;
  return <section className={compact ? "mt-5" : "card mt-5 max-w-2xl"} aria-label="Course enrollment and payment">
    <p className="eyebrow">{isPublic ? "Join this course" : "Assigned course"}</p>
    {!compact && <h1 className="mt-3 text-2xl font-semibold">{quote?.title || "Course access"}</h1>}
    <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{isPublic ? isFree ? "Enroll to open this free course’s lessons and PDF notes." : quote?.paid ? "Your payment is verified. Open the course to continue learning." : "Verified payment enrolls your account and opens this course’s learning materials." : isFree ? "Your instructor has made this course free. You can open its lessons and PDF notes without payment." : quote?.paid ? "Your payment is verified. You can open the course while it is assigned to your account." : "Your instructor has assigned this course. Payment is required before you can open its lessons and PDF notes."}</p>
    {needsPayment && validMode && <p className="mt-3 text-sm font-semibold text-primary-700 dark:text-primary-200">{quote.testMode ? "Stripe test mode — no real money is charged." : "Live payment — your payment method will be charged in INR."}</p>}
    {quote && <p className="mt-5 text-3xl font-semibold">{isFree ? "Free" : formatInr(quote.amountMinor)}</p>}
    {quote?.pendingOrderId && quote.currentAmountMinor !== undefined && quote.currentAmountMinor !== quote.amountMinor && <p className="mt-3 text-sm">This earlier payment attempt keeps its original price. The current course price is {formatInr(quote.currentAmountMinor)}.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
    {!data && !error && <p role="status" className="mt-4 text-sm">Loading course price…</p>}
    {needsPayment && (!data.readiness?.configured || !validMode) && <p className="mt-4 text-sm" role="status">Checkout is being configured. Please try again later.</p>}
    <div className="mt-6 flex flex-wrap gap-3">
      {quote && !needsPayment ? <button className="btn-primary" disabled={busy} onClick={() => needsEnrollment ? execute(true) : onAccess()}>{busy ? "Enrolling…" : needsEnrollment && isFree ? "Enroll for free" : "Open course"}</button> : data && <button className="btn-primary" disabled={busy || !data.readiness?.configured || !validMode} onClick={() => execute(false)}>{busy ? "Opening Stripe…" : quote.testMode ? "Continue to test checkout" : "Continue to payment"}</button>}
      <button className="btn-secondary" disabled={busy} onClick={load}>Refresh price</button>
      {quote?.pendingOrderId && <Link className="btn-secondary" to={`/payments/${quote.pendingOrderId}`}>Review payment attempt</Link>}
    </div>
  </section>;
}
