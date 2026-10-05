// Only known local learning routes may be used as authentication destinations.
export function safeReturnTo(value) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some((char) => char.charCodeAt(0) <= 32)) return "/dashboard";
  try {
    const url = new URL(value, "https://lessonloop.invalid");
    if (url.origin !== "https://lessonloop.invalid" || !/^\/(?:catalog(?:\/[^/]+)?|courses(?:\/[^/]+(?:\/(?:assessments|support))?)?|assessment-attempts\/[^/]+|payments(?:\/[^/]+)?|dashboard|student|instructor(?:\/courses(?:\/new|\/[^/]+\/(?:edit|curriculum|assessments|support))?)?|admin(?:\/courses\/upload)?)\/?$/.test(url.pathname)) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}
export function authReturn(location) {
  const query = new URLSearchParams(location.search).get("returnTo");
  const from = location.state?.from;
  return safeReturnTo(query || (from ? (from.pathname || "") + (from.search || "") + (from.hash || "") : ""));
}
export const authLink = (route, returnTo) => `${route}?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
