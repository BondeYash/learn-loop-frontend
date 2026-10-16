import { BRAND_NAME } from "../config/brand.js";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowUpRight, BookOpen, Compass, Sparkles } from "lucide-react";
import Brand from "../components/Brand.jsx";
import { ActionLink } from "../components/Action.jsx";
import { ThemeToggle } from "../theme/ThemeProvider.jsx";
export default function PublicLayout() {
  const location = useLocation(), home = location.pathname === "/", user = useSelector(state => state.auth.user);
  return <div className="workspace-shell public-shell">
    <a href="#public-content" className="skip-link">Skip to content</a>
    <div className="public-announcement"><Sparkles size={15} aria-hidden="true" /><span>Apni mehnat. Apna future.</span><span className="announcement-extra">Your next chapter starts with one topic.</span><ArrowUpRight size={15} aria-hidden="true" /></div>
    <header className="workspace-header public-header"><div className="public-header-inner"><Link to="/" aria-label={`${BRAND_NAME} home`}><Brand /></Link><nav aria-label="Main navigation"><NavLink className="workspace-nav" to="/catalog"><BookOpen size={17} aria-hidden="true" />Courses</NavLink>{home && <a className="workspace-nav public-study-nav" href="#study-plan"><Compass size={17} aria-hidden="true" />Study plan</a>}<ThemeToggle /><ActionLink className="btn-primary" to={user ? "/dashboard" : "/login"}>{user ? "Dashboard" : "Sign in"}<ArrowUpRight size={17} aria-hidden="true" /></ActionLink></nav></div></header>
    <main id="public-content" tabIndex={-1} className={`public-content ${home ? "public-home" : ""}`}><Outlet key={location.pathname} /></main>
    <footer className="public-footer"><div><Brand /><p>Mehnat ka naya address.</p></div><div className="public-footer-note"><span>{BRAND_NAME} · Government-exam learning</span><p>Learn. Practise. Repeat. Make it yours.</p></div><ActionLink className="btn-secondary" to="/catalog">Browse courses<ArrowUpRight size={18} aria-hidden="true" /></ActionLink></footer>
  </div>;
}
