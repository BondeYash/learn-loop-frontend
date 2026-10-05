const key = (courseId) => `lessonloop_source_${courseId}`;
export function getAttribution(courseId) {
  try { const value = JSON.parse(sessionStorage.getItem(key(courseId))); return navigator.globalPrivacyControl !== true && value?.consent === true && value.expiresAt > Date.now() && (value.sourceCode === "" || /^[a-f\d]{12}$/.test(value.sourceCode)) ? { consent: true, sourceCode: value.sourceCode } : null; }
  catch { return null; }
}
export function saveAttribution(courseId, sourceCode) {
  if (navigator.globalPrivacyControl === true) return false;
  try { sessionStorage.setItem(key(courseId), JSON.stringify({ consent: true, sourceCode: /^[a-f\d]{12}$/.test(sourceCode || "") ? sourceCode : "", expiresAt: Date.now() + 86400000 })); return true; }
  catch { return false; }
}
export function clearAttribution(courseId) { try { sessionStorage.removeItem(key(courseId)); } catch { /* Storage can be disabled. */ } }
