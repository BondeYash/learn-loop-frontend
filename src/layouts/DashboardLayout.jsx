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
  const managementLabel = user?.role === "admin" ? "Create course" : user?.role === "instructor" ? "My courses" : "Assigned courses";
  const navClass = ({ isActive }) => `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${isActive ? "bg-slate-100 text-slate-900 dark:bg-[#303035] dark:text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100"}`;
  return <div className="workspace-shell min-h-screen">
    <header className="workspace-header"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Link to="/dashboard" className="flex shrink-0 items-center"><Brand /></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex"><NavLink end to={dashboardPath} className={navClass}><LayoutDashboard size={16} />Dashboard</NavLink><NavLink to={managementPath} className={navClass}><BookOpen size={16} />{managementLabel}</NavLink></nav>
      <div className="flex items-center gap-2 sm:gap-3"><ThemeToggle /><div className="hidden max-w-44 text-right sm:block"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{user?.role}</p></div><button aria-label="Sign out" onClick={handleLogout} disabled={loading} className="btn-secondary gap-2 px-3" type="button"><LogOut size={16} /><span className="hidden sm:inline">{loading ? "Signing out…" : "Sign out"}</span></button></div>
    </div><nav aria-label="Mobile navigation" className="mx-auto flex max-w-6xl gap-1 border-t border-slate-100 dark:border-slate-800 px-4 py-2 md:hidden"><NavLink end to={dashboardPath} className={navClass}>Dashboard</NavLink><NavLink to={managementPath} className={navClass}>{managementLabel}</NavLink></nav></header>
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><Outlet /></main>
  </div>;
}
