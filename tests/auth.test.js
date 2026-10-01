import test from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { configureStore } from "@reduxjs/toolkit";
globalThis.localStorage = { removeItem() {}, setItem() {} };
const { default: reducer, fetchCurrentUser, loginUser, logout, sessionExpired } = await import("../src/slices/authSlice.js");
const { default: api } = await import("../src/services/axiosInstance.js");
const user = { id: "instructor-a", role: "instructor" };
const signedIn = () => configureStore({ reducer: { auth: reducer }, preloadedState: { auth: { user, status: "authenticated", loading: false, error: null } } });
test("late session response cannot restore a logged-out account", async () => {
  const store = signedIn(); let resolve;
  api.get = () => new Promise((done) => { resolve = done; });
  const pending = store.dispatch(fetchCurrentUser({ background: true }));
  store.dispatch(logout.fulfilled(undefined, "logout-request"));
  resolve({ data: { data: { user } } }); await pending;
  assert.equal(store.getState().auth.user, null);
  assert.equal(store.getState().auth.status, "anonymous");
});
test("late previous-account response cannot replace a new account", async () => {
  const store = signedIn(); let resolve;
  api.get = () => new Promise((done) => { resolve = done; });
  const pending = store.dispatch(fetchCurrentUser({ background: true }));
  const student = { id: "student-b", role: "student" };
  store.dispatch(loginUser.fulfilled({ user: student }, "new-login"));
  resolve({ data: { data: { user } } }); await pending;
  assert.deepEqual(store.getState().auth.user, student);
});
test("failed restoration removes account content and exposes retry state", async () => {
  const store = signedIn(); api.get = async () => { throw new Error("Network unavailable"); };
  await store.dispatch(fetchCurrentUser());
  assert.equal(store.getState().auth.user, null);
  assert.equal(store.getState().auth.status, "error");
});
test("expired session clears user state", async () => {
  const store = signedIn(); api.get = async () => { throw { response: { status: 401, data: { message: "Expired" } } }; };
  await store.dispatch(fetchCurrentUser());
  assert.equal(store.getState().auth.status, "anonymous");
  assert.equal(store.getState().auth.user, null);
});
test("blocked browser storage does not break successful cookie login", async () => {
  const store = signedIn(); store.dispatch(sessionExpired());
  globalThis.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  api.post = async () => ({ data: { data: { user } } });
  const action = await store.dispatch(loginUser({ email: "test@example.invalid", password: randomUUID() }));
  assert.equal(action.type, "auth/login/fulfilled");
  assert.deepEqual(store.getState().auth.user, user);
});
