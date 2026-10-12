import axiosInstance from "./axiosInstance.js";
import { getAttribution } from "./acquisition.js";
export const formatInr = (minor) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);
let scriptPromise;
const aborted = () => new DOMException("Checkout closed because this page changed.", "AbortError");
export function validCheckout(data, quotedAmountMinor, testMode) {
  const c = data?.checkout, order = data?.order;
  return typeof testMode === "boolean" && order?.provider === "razorpay" && order.testMode === testMode && order.amountMinor === quotedAmountMinor && /^[a-f\d]{24}$/i.test(order.id) && c?.provider === "razorpay" && new RegExp(`^rzp_${testMode ? "test" : "live"}_[A-Za-z0-9]+$`).test(c.keyId) && /^order_[A-Za-z0-9]{1,100}$/.test(c.orderId) && Number.isSafeInteger(c.amount) && c.amount >= 100 && c.amount === order.amountMinor && c.currency === "INR";
}
export function loadRazorpay() {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const failed = () => { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error("Razorpay checkout could not load. Check your connection and try again.")); };
    const timer = setTimeout(failed, 15000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { if (typeof window.Razorpay !== "function") return failed(); clearTimeout(timer); resolve(); };
    script.onerror = failed;
    document.head.appendChild(script);
  });
  return scriptPromise;
}
export function openRazorpay(checkout, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    let instance, finished = false;
    const complete = (result, error) => {
      if (finished) return;
      finished = true; signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve(result);
    };
    const cancel = () => { complete(null, aborted()); instance?.close(); };
    const closed = () => { const error = new Error("Checkout closed. You can retry or check the payment attempt below."); error.code = "RAZORPAY_CANCELED"; complete(null, error); };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      instance = new window.Razorpay({
        key: checkout.keyId, order_id: checkout.orderId, amount: checkout.amount, currency: "INR", name: checkout.name, description: checkout.description, prefill: checkout.prefill,
        retry: { enabled: false }, modal: { ondismiss: closed }, handler: (response) => complete(response),
      });
      instance.on("payment.failed", () => { const error = new Error("Payment was not completed. Check its status, then retry from this course."); error.code = "RAZORPAY_FAILED"; complete(null, error); instance.close(); });
      instance.open();
    } catch { complete(null, new Error("Razorpay checkout could not open. Retry shortly.")); }
  });
}
export async function createCheckout(courseId, quotedAmountMinor, attempt, testMode, signal) {
  await loadRazorpay();
  if (signal?.aborted) throw aborted();
  const attribution = testMode === false ? getAttribution(courseId) : null;
  const { data } = await axiosInstance.post("/payments/checkout", { courseId, quotedAmountMinor, ...(attribution ? { attribution } : {}) }, { signal, headers: { "Idempotency-Key": attempt } });
  if (!validCheckout(data.data, quotedAmountMinor, testMode)) throw new Error("The server returned an invalid checkout. Refresh the price before retrying.");
  let response;
  try { response = await openRazorpay(data.data.checkout, signal); }
  catch (error) {
    if (error.code === "RAZORPAY_FAILED" && !signal?.aborted) { try { await axiosInstance.post(`/payments/orders/${data.data.order.id}/refresh`, {}, { signal }); } catch { /* Payment history retains recovery. */ } }
    throw error;
  }
  try {
    const result = await axiosInstance.post(`/payments/orders/${data.data.order.id}/verify`, { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }, { signal });
    return result.data.data;
  } catch (error) {
    if (signal?.aborted || [400, 401, 403, 409].includes(error.response?.status)) throw error;
    // A lost verification response does not mean the charge failed. The signed
    // webhook and payment-status page recover the same saved purchase.
    return { order: data.data.order, verificationPending: true };
  }
}
