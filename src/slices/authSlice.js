import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
// Remove legacy bearer credentials; sessions now live in HttpOnly cookies.
try { localStorage.removeItem("lms_token"); } catch { /* Cookie sessions also work when browser storage is blocked. */ }
const announce = () => { try { localStorage.setItem("lms_account_changed", `${Date.now()}-${Math.random()}`); } catch { /* Other tabs will still recheck their session periodically. */ } };
export const registerUser = createAsyncThunk("auth/register", async (payload, { rejectWithValue }) => {
  try { const result = (await axiosInstance.post("/auth/register", payload)).data.data; announce(); return result; }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});
export const loginUser = createAsyncThunk("auth/login", async (payload, { rejectWithValue }) => {
  try { const result = (await axiosInstance.post("/auth/login", payload)).data.data; announce(); return result; }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});
export const logout = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try { await axiosInstance.post("/auth/logout"); announce(); }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});
export const fetchCurrentUser = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try { return (await axiosInstance.get("/auth/me")).data.data.user; }
  catch (error) { return rejectWithValue({ anonymous: error.response?.status === 401, message: errorMessage(error) }); }
}, { condition: (_, { getState }) => getState().auth.status !== "checking" });
const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, status: "idle", loading: false, error: null, sessionRequestId: null },
  reducers: {
    setSession(state, action) { state.sessionRequestId = null; state.user = action.payload.user; state.status = "authenticated"; state.loading = false; state.error = null; announce(); },
    sessionExpired(state) { state.sessionRequestId = null; state.user = null; state.status = "anonymous"; state.loading = false; state.error = null; },
    clearAuthError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.sessionRequestId = null; state.loading = true; state.error = null; };
    const fulfilled = (state, action) => { state.sessionRequestId = null; state.loading = false; state.user = action.payload.user; state.status = "authenticated"; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };
    builder.addCase(registerUser.pending, pending).addCase(registerUser.fulfilled, fulfilled).addCase(registerUser.rejected, rejected)
      .addCase(loginUser.pending, pending).addCase(loginUser.fulfilled, fulfilled).addCase(loginUser.rejected, rejected)
      .addCase(logout.pending, pending).addCase(logout.fulfilled, (state) => { state.sessionRequestId = null; state.user = null; state.status = "anonymous"; state.loading = false; state.error = null; })
      .addCase(logout.rejected, rejected)
      .addCase(fetchCurrentUser.pending, (state, action) => { state.sessionRequestId = action.meta.requestId; if (!action.meta.arg?.background) { state.status = "checking"; state.user = null; } state.error = null; })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => { if (state.sessionRequestId !== action.meta.requestId) return; state.sessionRequestId = null; state.status = "authenticated"; state.user = action.payload; })
      .addCase(fetchCurrentUser.rejected, (state, action) => { if (state.sessionRequestId !== action.meta.requestId) return; state.sessionRequestId = null; state.user = null; state.status = action.payload?.anonymous ? "anonymous" : "error"; state.error = action.payload?.message; });
  },
});
export const { setSession, sessionExpired, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
