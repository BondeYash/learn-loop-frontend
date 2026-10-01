import { useDispatch, useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchCurrentUser } from "../slices/authSlice.js";
export default function ProtectedRoute({ roles, publicOnly = false }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, status, error } = useSelector((state) => state.auth);
  if (status === "idle" || status === "checking") return <div className="grid min-h-screen place-items-center text-primary-600 dark:text-primary-300" role="status">Checking your session…</div>;
  if (status === "error") return <main className="card m-8"><p role="alert">Unable to check your session: {error}</p><button className="btn-primary mt-4" onClick={() => dispatch(fetchCurrentUser())}>Retry connection</button></main>;
  if (publicOnly) return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
