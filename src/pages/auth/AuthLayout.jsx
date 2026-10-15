import { BRAND_NAME } from "../../config/brand.js";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import { ActionLink } from "../../components/Action.jsx";
import Brand from "../../components/Brand.jsx";
import { ThemeToggle } from "../../theme/ThemeProvider.jsx";
import "./AuthLayout.css";
export default function AuthLayout({ children }) {
  return <main className="auth-shell min-h-screen"><header className="auth-header"><Link to="/" aria-label={`${BRAND_NAME} home`}><Brand /></Link><div className="flex items-center gap-3"><ActionLink to="/catalog" className="auth-browse"><BookOpen size={17} aria-hidden="true" />Browse courses</ActionLink><ThemeToggle /></div></header><div className="auth-frame"><aside className="auth-poster" aria-label={`Learning with ${BRAND_NAME}`}><p className="hero-kicker"><Sparkles size={17} aria-hidden="true" />SMALL STEPS. BIG ENERGY.</p><h2>Your next<br /><span>chapter.</span><ArrowUpRight size={58} aria-hidden="true" /></h2><div className="auth-photo"><img src="/images/student-at-desk.webp" alt="A student working with a notebook and laptop" width="800" height="1200" /><span>Make today count. ✳</span></div><p>Ek topic. Ek naya step.<br />Taiyaari, apne andaaz mein.</p></aside><section className="auth-form min-w-0"><p className="auth-mobile-note lg:hidden">Chalo, learning shuru karein.</p>{children}</section></div></main>;
}
