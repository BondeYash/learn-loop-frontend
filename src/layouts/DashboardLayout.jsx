import Brand from "../components/Brand.jsx";
import { ThemeToggle } from "../theme/ThemeProvider.jsx";
import { toast } from "react-toastify";
import { LogOut, LayoutDashboard, BookOpen } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../slices/authSlice.js";
const paths = { student: "/student", instructor: "/instructor", admin: "/admin" };
export function DashboardIndex() {
  const role = useSelector((state) => state.auth.user?.role);
  return <Navigate to={paths[role] || "/login"} replace />;
}
export default function DashboardLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading } = useSelector((state) => state.auth);
  const handleLogout = async () => { const result = await dispatch(logout()); if (logout.fulfilled.match(result)) navigate("/login", { replace: true }); else toast.error(result.payload || "Sign out failed. Check your connection and retry."); };
  const dashboardPath = paths[user?.role] || "/dashboard";
  const managementPath = user?.role === "admin" ? "/admin/courses/upload" : user?.role === "instructor" ? "/instructor/courses" : "/courses";
  const managementLabel = user?.role === "admin" ? "Create course" : user?.role === "instructor" ? "My courses" : "All courses";
  const navClass = ({ isActive }) => `workspace-nav ${isActive ? "workspace-nav-active" : ""}`;
  return <div className="workspace-shell min-h-screen">
    <header className="workspace-header"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link to="/dashboard" className="flex shrink-0 items-center"><Brand /></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex"><NavLink end to={dashboardPath} className={navClass}><LayoutDashboard size={16} />Dashboard</NavLink><NavLink to={managementPath} className={navClass}><BookOpen size={16} />{managementLabel}</NavLink>{user?.role === "student" && <NavLink to="/payments" className={navClass}>Payments</NavLink>}</nav>
      <div className="flex items-center gap-2 sm:gap-3"><ThemeToggle /><div className="hidden max-w-44 text-right sm:block"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{user?.role}</p></div><button aria-label="Sign out" onClick={handleLogout} disabled={loading} className="btn-secondary gap-2 px-3" type="button"><LogOut size={16} /><span className="hidden sm:inline">{loading ? "Signing out…" : "Sign out"}</span></button></div>
    </div><nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl gap-1 border-t border-slate-100 dark:border-slate-800 px-4 py-2 md:hidden"><NavLink end to={dashboardPath} className={navClass}>Dashboard</NavLink><NavLink to={managementPath} className={navClass}>{managementLabel}</NavLink>{user?.role === "student" && <NavLink to="/payments" className={navClass}>Payments</NavLink>}</nav></header>
    <a href="#workspace-content" className="skip-link">Skip to content</a><main id="workspace-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"><Outlet /></main>
    <footer className="mx-auto flex max-w-7xl justify-end px-4 pb-6 sm:px-6"><Link to="/change-password" className="text-xs text-slate-500 underline dark:text-slate-400">Change my password</Link></footer>
  </div>;
}
