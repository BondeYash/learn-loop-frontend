import axiosInstance from "./axiosInstance.js";
const retryable = error => !error.response && error.code !== "ERR_CANCELED" || [408, 429, 500, 502, 503, 504].includes(error.response?.status);
export function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); signal?.removeEventListener("abort", aborted); reject(Object.assign(new Error("Request canceled"), { code: "ERR_CANCELED" })); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", aborted); resolve(); }, ms);
    if (signal?.aborted) aborted(); else signal?.addEventListener("abort", aborted, { once: true });
  });
}
export const createResilientGet = (get, wait = waitForRetry) => async (url, config = {}) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (config.signal?.aborted) throw Object.assign(new Error("Request canceled"), { code: "ERR_CANCELED" });
    try { return await get(url, { timeout: 45000, ...config }); }
    catch (error) { if (attempt === 2 || !retryable(error) || config.signal?.aborted) throw error; await wait([600, 1600][attempt], config.signal); }
  }
};
export default createResilientGet((url, config) => axiosInstance.get(url, config));
