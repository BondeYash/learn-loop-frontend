import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { authReturn } from "../../services/authReturn.js";
import AuthLayout from "./AuthLayout.jsx";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import { logout, setSession } from "../../slices/authSlice.js";

export default function ChangePasswordPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch(); const navigate = useNavigate(); const location = useLocation();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const required = user?.mustChangePassword;
  const submit = async (event) => {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    if (fields.get("password") !== fields.get("confirmation")) { setError("Your new passwords do not match."); return; }
    setBusy(true); setError("");
    try {
      const { data } = await axiosInstance.post("/auth/change-password", { currentPassword: fields.get("currentPassword"), password: fields.get("password") });
      form.reset(); dispatch(setSession(data.data)); navigate(authReturn(location), { replace: true });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const signOut = async () => {
    setBusy(true); const result = await dispatch(logout());
    if (logout.fulfilled.match(result)) navigate("/login", { replace: true }); else setError(result.payload || "Could not sign out. Retry.");
    setBusy(false);
  };
  return <AuthLayout><section className="card">
    <div className="mb-5 inline-flex rounded-2xl bg-blue-50 p-3 text-primary-600 dark:bg-blue-950 dark:text-blue-300"><KeyRound size={24} /></div>
    <h1 className="text-2xl font-semibold">{required ? "Make this account yours" : "Change your password"}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{required ? "Your administrator gave you a temporary password. Choose a private password to open your instructor workspace." : "Choose a new password. Your other sessions will be signed out."}</p>
    <p className="mt-3 break-all text-sm font-medium">{user?.email}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">{required ? "Temporary password" : "Current password"}<input required name="currentPassword" type="password" autoComplete="current-password" maxLength={72} className="input-field mt-2" disabled={busy} /></label>
      <label className="block text-sm font-medium">New password<input required name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} className="input-field mt-2" aria-describedby="password-help" disabled={busy} /></label>
      <p id="password-help" className="text-xs leading-5 text-slate-500 dark:text-slate-400">Use at least 12 characters, up to 72 UTF-8 bytes. Choose a password you do not use elsewhere.</p>
      <label className="block text-sm font-medium">Confirm new password<input required name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={72} className="input-field mt-2" disabled={busy} /></label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save private password"}</button>
    </form>
    <div className="mt-5 flex justify-between text-sm">{!required && <Link to="/dashboard" className="text-primary-600 dark:text-primary-300">Back to dashboard</Link>}<button type="button" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400" onClick={signOut} disabled={busy}><LogOut size={15} />Sign out</button></div>
  </section></AuthLayout>;
}
