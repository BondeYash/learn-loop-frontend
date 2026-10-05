import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { formatInr } from "../services/payments.js";
import { paymentLabels } from "./PaymentStatusPage.jsx";
export default function PaymentHistoryPage() {
  const [page, setPage] = useState(1), [data, setData] = useState(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const request = new AbortController(); setData(null); setError("");
    axiosInstance.get("/payments/orders", { params: { page, limit: 20 }, signal: request.signal }).then(({ data }) => { if (!request.signal.aborted) setData(data.data); }).catch((e) => { if (!request.signal.aborted) setError(errorMessage(e)); });
    return () => request.abort();
  }, [page, retry]);
  return <section><h1 className="text-3xl font-semibold">Payment history</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Your course payment attempts and their verified status. These records are not tax invoices.</p>
    {data && <p className="mt-3 text-sm font-medium">{data.testMode ? "Test payments — no real money charged" : "Live payments in INR"}</p>}
    {error && <div className="card mt-5" role="alert"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Retry history</button></div>}
    {!data && !error && <p className="card mt-5" role="status">Loading payment history…</p>}
    {data && <><div className="mt-5 space-y-4">{data.orders.length ? data.orders.map((order) => <article className="card flex flex-wrap items-center justify-between gap-4" key={order.id}><div className="min-w-0"><h2 className="break-words font-semibold">{order.title}</h2><p className="mt-2 text-sm">{formatInr(order.amountMinor)} · {paymentLabels[order.status] || order.status}</p>{order.createdAt && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(order.createdAt).toLocaleString("en-IN")}</p>}</div><Link className="btn-secondary" to={`/payments/${order.id}`}>View payment record</Link></article>) : <p className="card">You have no payment attempts in this mode.</p>}</div><nav className="mt-6 flex flex-wrap items-center gap-4" aria-label="Payment history pages"><button className="btn-secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page}</span><button className="btn-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage((value) => value + 1)}>Next</button></nav></>}
  </section>;
}
