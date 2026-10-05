import { useDispatch, useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authReturn, authLink, safeReturnTo } from "../services/authReturn.js";
import { fetchCurrentUser } from "../slices/authSlice.js";
export default function ProtectedRoute({ roles, publicOnly = false, allowPasswordChange = false }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, status, error } = useSelector((state) => state.auth);
  if (status === "idle" || status === "checking") return <div className="grid min-h-screen place-items-center text-primary-600 dark:text-primary-300" role="status">Checking your session…</div>;
  if (status === "error") return <main className="card m-8"><p role="alert">Unable to check your session: {error}</p><button className="btn-primary mt-4" onClick={() => dispatch(fetchCurrentUser())}>Retry connection</button></main>;
  if (publicOnly) return user ? <Navigate to={user.mustChangePassword ? authLink("/change-password", authReturn(location)) : authReturn(location)} replace /> : <Outlet />;
  if (!user) return <Navigate to={authLink("/login", safeReturnTo(location.pathname + location.search + location.hash))} replace state={{ from: location }} />;
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to={authLink("/change-password", safeReturnTo(location.pathname + location.search + location.hash))} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
