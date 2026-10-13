export function coursePrice(amountMinor) {
  return amountMinor === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: amountMinor % 100 ? 2 : 0 }).format(amountMinor / 100);
}
