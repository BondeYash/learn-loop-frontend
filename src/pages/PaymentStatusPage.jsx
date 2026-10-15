import { BackLink, ActionLink, Button } from "../components/Action.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { formatInr } from "../services/payments.js";

export const paymentLabels = { pending: "Awaiting payment verification", paid: "Payment verified", failed: "Payment was not completed", expired: "Checkout expired", refunded: "Payment was refunded", partially_refunded: "Payment needs review after a partial refund", disputed: "Payment is under dispute", reversed: "Payment was reversed" };
export default function PaymentStatusPage() {
  const { id } = useParams(), [params] = useSearchParams();
  const [order, setOrder] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const action = useRef(null), pending = useRef(false);
  const load = useCallback(async (signal) => {
    try { const result = await axiosInstance.get(`/payments/orders/${id}`, { signal }); if (!signal.aborted) { setOrder(result.data.data.order); setError(""); } }
    catch (e) { if (!signal.aborted) setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => {
    const controller = new AbortController(); let attempts = 0;
    load(controller.signal);
    const timer = setInterval(() => { if (++attempts > 20) { clearInterval(timer); return; } load(controller.signal); }, 3000);
    return () => { controller.abort(); action.current?.abort(); clearInterval(timer); };
  }, [load]);
  const refresh = async () => {
    if (pending.current) return; pending.current = true; setBusy(true); setError("");
    const controller = new AbortController(); action.current = controller;
    try { const result = await axiosInstance.post(`/payments/orders/${id}/refresh`, {}, { signal: controller.signal }); if (!controller.signal.aborted) setOrder(result.data.data.order); }
    catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); } finally { pending.current = false; if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="mx-auto max-w-2xl"><BackLink to="/payments" >Payment history</BackLink><div className="card mt-5"><p className="eyebrow">{order?.provider === "legacy" ? "Payment record" : order?.testMode === true ? "Razorpay test payment" : order?.testMode === false ? "Razorpay live payment" : "Payment record"}</p><h1 className="mt-3 text-2xl font-semibold" aria-live="polite">{order ? order.status === "paid" && order.testMode ? "Test payment verified" : paymentLabels[order.status] || "Checking payment" : "Checking payment…"}</h1><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{order?.testMode === true ? "No real money is charged in this test flow. " : order?.testMode === false ? "This is a real payment in INR. " : ""}Course access follows verified payment or instructor-granted free access, enrollment and current course availability.</p>{params.get("checkout") === "canceled" && order?.status !== "paid" && <p className="mt-4 text-sm">You returned from checkout. You can reopen it from the course.</p>}
    {order && <section className="mt-5" aria-label="Payment record"><h2 className="font-semibold">{order.title} · {formatInr(order.amountMinor)}</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500 dark:text-slate-400">Payment reference</dt><dd className="mt-1 break-all">{order.id}</dd></div>{order.createdAt && <div><dt className="text-slate-500 dark:text-slate-400">Created</dt><dd>{new Date(order.createdAt).toLocaleString("en-IN")}</dd></div>}{order.paidAt && <div><dt className="text-slate-500 dark:text-slate-400">Payment verified</dt><dd>{new Date(order.paidAt).toLocaleString("en-IN")}</dd></div>}{order.refundedMinor > 0 && <div><dt className="text-slate-500 dark:text-slate-400">Refunded amount</dt><dd>{formatInr(order.refundedMinor)}</dd></div>}</dl><p className="mt-4 text-xs text-slate-500 dark:text-slate-400">This is your payment record, not a tax invoice.</p>{order.status === "paid" && !order.canAccess && <p className="mt-4 text-sm">Payment is verified. Check the course for current enrollment and availability.</p>}</section>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="mt-6 flex flex-wrap gap-3">{order && <ActionLink className="btn-primary" to={`/courses/${order.courseId}`}>{order.canAccess ? "Open course" : "Back to course"}</ActionLink>}<Button className="btn-secondary" disabled={busy} onClick={refresh}>{busy ? "Checking payment…" : "Check payment status"}</Button></div></div></section>;
}
