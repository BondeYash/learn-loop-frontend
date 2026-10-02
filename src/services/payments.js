import axiosInstance from "./axiosInstance.js";
export const formatInr = (minor) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);
export function isStripeCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port; }
  catch { return false; }
}
export async function createCheckout(courseId, quotedAmountMinor, attempt, signal) {
  const { data } = await axiosInstance.post("/payments/checkout", { courseId, quotedAmountMinor }, { signal, headers: { "Idempotency-Key": attempt } });
  if (data.data.order?.testMode !== true || !isStripeCheckoutUrl(data.data.url)) throw new Error("The server did not return a valid Stripe test checkout.");
  return data.data;
}
