import axiosInstance from "./axiosInstance.js";
import { getAttribution } from "./acquisition.js";
export const formatInr = (minor) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100);
export function isStripeCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port; }
  catch { return false; }
}
export async function createCheckout(courseId, quotedAmountMinor, attempt, testMode, signal) {
  const attribution = testMode === false ? getAttribution(courseId) : null;
  const { data } = await axiosInstance.post("/payments/checkout", { courseId, quotedAmountMinor, ...(attribution ? { attribution } : {}) }, { signal, headers: { "Idempotency-Key": attempt } });
  if (typeof testMode !== "boolean" || data.data.order?.testMode !== testMode || !isStripeCheckoutUrl(data.data.url)) throw new Error("The server did not return a valid Stripe checkout for the displayed mode. Refresh the price before retrying.");
  return data.data;
}
