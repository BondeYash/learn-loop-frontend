import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo, authReturn, authLink } from "../src/services/authReturn.js";
test("authentication preserves known local learning destinations and rejects external or malformed destinations", () => {
  for (const value of ["/catalog/synthetic-ccc", "/courses/507f1f77bcf86cd799439022", "/payments/record?checkout=success", "/catalog?q=CCC#courses", "/dashboard", "/student", "/instructor/courses/course/edit", "/admin/courses/upload"]) assert.equal(safeReturnTo(value), value);
  for (const value of [undefined, {}, "https://evil.invalid", "//evil.invalid/catalog", "/\\evil.invalid", "/login", "/catalog/x/extra", "/catalog/\nfoo", "/catalog/ foo", "javascript:alert(1)", "/catalog/../../login"]) assert.equal(safeReturnTo(value), "/dashboard");
  assert.equal(authReturn({search:"?returnTo=%2Fcatalog%2Fsynthetic-ccc",state:{from:{pathname:"/student"}}}), "/catalog/synthetic-ccc");
  assert.equal(authReturn({search:"",state:{from:{pathname:"/payments/record",search:"?checkout=canceled"}}}), "/payments/record?checkout=canceled");
  assert.equal(authLink("/register", "//evil.invalid"), "/register?returnTo=%2Fdashboard");
  for (const value of ["/courses/course/assessments", "/assessment-attempts/attempt", "/instructor/courses/course/assessments"]) assert.equal(safeReturnTo(value), value);
  for (const value of ["/assessment-attempts", "/assessment-attempts/id/answers", "/courses/id/assessments/extra"]) assert.equal(safeReturnTo(value), "/dashboard");
});
