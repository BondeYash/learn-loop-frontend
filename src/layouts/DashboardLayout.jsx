import { useEffect, useRef } from "react";
import { BRAND_NAME } from "../config/brand.js";
import Brand from "../components/Brand.jsx";
import { ThemeToggle } from "../theme/ThemeProvider.jsx";
import { Button, ActionLink } from "../components/Action.jsx";
import { toast } from "../services/notifications.jsx";
import { ArrowUpRight, BookOpen, CreditCard, GraduationCap, LayoutDashboard, LogOut, Plus, Settings2, Sparkles } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../slices/authSlice.js";
const paths = { student: "/student", instructor: "/instructor", admin: "/admin" };
export function DashboardIndex() {
  const role = useSelector(state => state.auth.user?.role);
  return <Navigate to={paths[role] || "/login"} replace />;
}
export default function DashboardLayout() {
  const dispatch = useDispatch(), navigate = useNavigate(), location = useLocation();
  const { user, loading } = useSelector(state => state.auth);
  const handleLogout = async () => { const result = await dispatch(logout()); if (logout.fulfilled.match(result)) navigate("/login", { replace: true }); else toast.error(result.payload || "Sign out failed. Check your connection and retry."); };
  const shell = useRef(null);
  const isChat = user?.role === "student" && /^\/courses\/[^/]+\/doubts\/?$/.test(location.pathname);
  useEffect(() => {
    if (!isChat) return;
    const viewport = window.visualViewport, node = shell.current;
    const resize = () => {
      const height = viewport?.height || window.innerHeight;
      node?.style.setProperty("--chat-viewport-height", `${height}px`);
      const typing = node?.contains(document.activeElement) && document.activeElement?.tagName === "TEXTAREA";
      node?.classList.toggle("app-shell--chat-keyboard", window.innerWidth <= 900 && height < 500 && (height < window.innerHeight - 80 || typing));
    };
    resize(); viewport?.addEventListener("resize", resize); window.addEventListener("resize", resize); node?.addEventListener("focusin", resize); node?.addEventListener("focusout", resize);
    return () => { viewport?.removeEventListener("resize", resize); window.removeEventListener("resize", resize); node?.removeEventListener("focusin", resize); node?.removeEventListener("focusout", resize); node?.style.removeProperty("--chat-viewport-height"); node?.classList.remove("app-shell--chat-keyboard"); };
  }, [isChat]);
  const dashboardPath = paths[user?.role] || "/dashboard";
  const managementPath = user?.role === "admin" ? "/admin/courses/upload" : user?.role === "instructor" ? "/instructor/courses" : "/courses";
  const managementLabel = user?.role === "admin" ? "Create course" : user?.role === "instructor" ? "My courses" : "All courses";
  const links = [{ to: dashboardPath, label: "Dashboard", icon: LayoutDashboard, end: true }, { to: managementPath, label: managementLabel, end: user?.role === "student", icon: user?.role === "admin" ? Plus : BookOpen }, ...(user?.role === "student" ? [{ to: "/doubts", label: "Doubt Dost", icon: Sparkles }, { to: "/payments", label: "Payments", icon: CreditCard }] : []), ...(user?.role === "admin" ? [{ to: "/admin/doubt-dost", label: "Doubt Dost", icon: Sparkles }] : [])];
  const navClass = (to, isActive) => `workspace-nav ${isActive || to === "/doubts" && isChat ? "workspace-nav-active" : ""}`;
  const title = location.pathname.includes("doubt") ? "Your doubt-solving space" : user?.role === "student" ? "Make today a little better." : "Good teaching starts here.";
  return <div ref={shell} className={`workspace-shell app-shell${isChat ? " app-shell--chat" : ""}`}>
    <a href="#workspace-content" className="skip-link">Skip to content</a>
    <aside className="app-sidebar"><Link to="/dashboard" aria-label={`${BRAND_NAME} dashboard`}><Brand /></Link><p className="sidebar-label">YOUR {user?.role === "student" ? "STUDY" : "TEACHING"} SPACE</p><nav aria-label="Main navigation">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} end={end} to={to} className={({ isActive }) => navClass(to, isActive)} aria-current={to === "/doubts" && isChat ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span><ArrowUpRight className="nav-arrow" size={16} aria-hidden="true" /></NavLink>)}</nav><div className="sidebar-note"><span className="sidebar-doodle" aria-hidden="true">✳</span><p>Big dreams.<br /><strong>One step daily.</strong></p><Link to="/catalog">Find your next course<ArrowUpRight size={17} aria-hidden="true" /></Link></div><Link className="sidebar-settings" to="/change-password"><Settings2 size={18} aria-hidden="true" />Change my password</Link><span className="sidebar-footer">PRANEET VIDYAPEETH</span></aside>
    <div className="app-stage"><header className="workspace-header app-topbar"><Link className="mobile-brand" to="/dashboard" aria-label={`${BRAND_NAME} dashboard`}><Brand /></Link><div className="topbar-context"><GraduationCap size={21} aria-hidden="true" /><span>{title}</span></div><div className="topbar-account"><ThemeToggle /><div className="account-identity"><span className="account-avatar" aria-hidden="true">{user?.name?.slice(0, 1).toUpperCase() || "P"}</span><div><p>{user?.name}</p><span>{user?.role}</span></div></div><Button aria-label="Sign out" onClick={handleLogout} disabled={loading} className="btn-secondary signout-button" type="button"><LogOut size={17} aria-hidden="true" /><span>{loading ? "Signing out…" : "Sign out"}</span></Button></div></header>
      <nav aria-label="Mobile navigation" className="mobile-workspace-nav">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} end={end} to={to} className={({ isActive }) => navClass(to, isActive)} aria-current={to === "/doubts" && isChat ? "page" : undefined}><Icon size={17} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
      <main id="workspace-content" tabIndex={-1} className="workspace-content"><Outlet key={location.pathname} /></main>
      <footer className="workspace-footer"><span>Thoda aaj. Thoda aur kal.</span><ActionLink to="/change-password" className="settings-link"><Settings2 size={15} aria-hidden="true" />Change my password</ActionLink></footer>
    </div>
  </div>;
}
