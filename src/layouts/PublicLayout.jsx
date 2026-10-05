import { Link, NavLink, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Brand from "../components/Brand.jsx";
import { ThemeToggle } from "../theme/ThemeProvider.jsx";

export default function PublicLayout() {
  const user = useSelector((state) => state.auth.user);
  return <div className="workspace-shell flex min-h-screen flex-col">
    <a href="#public-content" className="skip-link">Skip to content</a>
    <header className="workspace-header"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link to="/" aria-label="LessonLoop home"><Brand /></Link>
      <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2"><NavLink className="workspace-nav" to="/catalog">Courses</NavLink><ThemeToggle /><Link className="btn-secondary" to={user ? "/dashboard" : "/login"}>{user ? "Dashboard" : "Sign in"}</Link></nav>
    </div></header>
    <main id="public-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 break-words px-4 py-10 sm:px-6 sm:py-14"><Outlet /></main>
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:px-6"><span>LessonLoop · Government-exam learning</span><Link className="underline underline-offset-4" to="/catalog">Browse courses</Link></footer>
  </div>;
}
