import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { formatInr } from "../services/payments.js";

const labels = { pending: "Awaiting payment verification", paid: "Test payment verified", failed: "Payment was not completed", expired: "Checkout expired", refunded: "Payment was refunded", partially_refunded: "Payment needs review after a partial refund", disputed: "Payment is under dispute", reversed: "Payment was reversed" };
export default function PaymentStatusPage() {
  const { id } = useParams(), [params] = useSearchParams();
  const [order, setOrder] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async (signal) => {
    try { const result = await axiosInstance.get(`/payments/orders/${id}`, { signal }); setOrder(result.data.data.order); setError(""); }
    catch (e) { if (e.code !== "ERR_CANCELED") setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => {
    const controller = new AbortController(); let attempts = 0;
    load(controller.signal);
    const timer = setInterval(() => { if (++attempts > 20) { clearInterval(timer); return; } load(controller.signal); }, 3000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);
  const refresh = async () => {
    if (busy) return; setBusy(true); setError("");
    try { const result = await axiosInstance.post(`/payments/orders/${id}/refresh`); setOrder(result.data.data.order); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-2xl"><Link to="/dashboard" className="text-sm text-primary-600 dark:text-primary-300">← Dashboard</Link><div className="card mt-5"><p className="eyebrow">Stripe test payment</p><h1 className="mt-3 text-2xl font-semibold" aria-live="polite">{order ? labels[order.status] || "Checking payment" : "Checking payment…"}</h1><p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">No real money is charged in this test flow. Course access follows the verified server payment status and your current assignment.</p>{params.get("checkout") === "canceled" && order?.status !== "paid" && <p className="mt-4 text-sm">You returned from checkout. You can reopen it from the course.</p>}{order && <p className="mt-5 font-semibold">{order.title} · {formatInr(order.amountMinor)}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="mt-6 flex flex-wrap gap-3">{order && <Link className="btn-primary" to={`/courses/${order.courseId}`}>{order.status === "paid" ? "Open course" : "Back to course"}</Link>}<button className="btn-secondary" disabled={busy} onClick={refresh}>{busy ? "Checking Stripe…" : "Check payment status"}</button></div></div></section>;
}
