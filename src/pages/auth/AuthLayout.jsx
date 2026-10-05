import { Link } from "react-router-dom";
import Brand from "../../components/Brand.jsx";
import { StudyArtwork } from "../../components/StudyHero.jsx";
import { ThemeToggle } from "../../theme/ThemeProvider.jsx";
import "./AuthLayout.css";
export default function AuthLayout({ children }) {
  return <main className="auth-shell min-h-screen"><header className="auth-header"><Link to="/" aria-label="LessonLoop home"><Brand /></Link><div className="flex items-center gap-3"><Link to="/catalog" className="hidden text-sm font-medium text-muted underline underline-offset-4 sm:block">Browse courses</Link><ThemeToggle /></div></header><div className="auth-frame"><aside className="auth-poster" aria-label="Learning with LessonLoop"><p className="hero-kicker">Apna next step</p><h2>Padhai se<br /><span>milte hain.</span></h2><p>Course chunein, sample dekhein. Jab ready hon, learning shuru karein.</p><StudyArtwork /><span className="auth-note">Ek topic. Ek naya step.</span></aside><section className="auth-form min-w-0"><p className="auth-mobile-note lg:hidden">Chalo, learning shuru karein.</p>{children}</section></div></main>;
}
