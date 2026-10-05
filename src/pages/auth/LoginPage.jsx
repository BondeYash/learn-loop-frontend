import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { authReturn, authLink } from "../../services/authReturn.js";
import AuthLayout from "./AuthLayout.jsx";
import { loginUser } from "../../slices/authSlice.js";

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm(); const dispatch = useDispatch(); const navigate = useNavigate(); const location = useLocation(); const loading = useSelector((state) => state.auth.loading);
  const onSubmit = async (values) => { const result = await dispatch(loginUser(values)); if (loginUser.fulfilled.match(result)) { toast.success("Welcome back!"); navigate(authReturn(location), { replace: true }); } else toast.error(result.payload || "Unable to sign in"); };
  return <AuthLayout><div className="card"><h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Welcome back</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">Sign in to continue learning.</p><form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}><label className="block text-sm font-medium">Email<input className="input-field mt-1" type="email" autoComplete="email" {...register("email", { required: "Email is required" })} /></label>{errors.email && <p className="text-sm text-red-600 dark:text-red-300">{errors.email.message}</p>}<label className="block text-sm font-medium">Password<input className="input-field mt-1" type="password" autoComplete="current-password" {...register("password", { required: "Password is required" })} /></label>{errors.password && <p className="text-sm text-red-600 dark:text-red-300">{errors.password.message}</p>}<button disabled={loading} className="btn-primary w-full" type="submit">{loading ? "Signing in…" : "Sign in"}</button></form><div className="mt-5 flex justify-between text-sm"><Link className="text-primary-600 dark:text-primary-300 hover:underline" to="/forgot-password">Forgot password?</Link><Link className="text-primary-600 dark:text-primary-300 hover:underline" to={authLink("/register", authReturn(location))}>Create account</Link></div></div></AuthLayout>;
}
