import { ArrowUpRight, BookOpen, FileText, ClipboardCheck } from "lucide-react";
import "./StudyHero.css";
export function StudyArtwork() {
  return <svg className="study-artwork" viewBox="0 0 360 330" aria-hidden="true">
    <ellipse cx="185" cy="180" rx="154" ry="109" transform="rotate(-16 185 180)" fill="#61D6E3" stroke="#FFF9EF" strokeWidth="5" />
    <ellipse cx="185" cy="180" rx="140" ry="96" transform="rotate(-16 185 180)" fill="none" stroke="#262238" strokeWidth="2" />
    <g transform="rotate(8 185 167)"><rect x="105" y="52" width="155" height="220" rx="16" fill="#FFF9EF" stroke="#262238" strokeWidth="3" /><path d="M133 57v210" stroke="#F7BFD7" strokeWidth="2" /><path d="M146 95h87M146 127h77M146 159h87M146 191h60M146 223h83" stroke="#D8C7FF" strokeWidth="5" strokeLinecap="round" /><rect x="175" y="47" width="43" height="56" rx="5" fill="#5D37C8" stroke="#262238" strokeWidth="2" /><path d="m188 66 10 13 8-7" fill="none" stroke="#FFF9EF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
    <g transform="rotate(-12 68 66)"><path d="m68 20 12 27 30-2-21 22 11 28-29-13-24 19 3-31-26-16 30-7Z" fill="#F7B54A" stroke="#FFF9EF" strokeWidth="6" /><path d="m68 20 12 27 30-2-21 22 11 28-29-13-24 19 3-31-26-16 30-7Z" fill="none" stroke="#262238" strokeWidth="2" /></g>
    <g transform="rotate(12 285 83)"><circle cx="285" cy="83" r="39" fill="#F7BFD7" stroke="#FFF9EF" strokeWidth="5" /><path d="m269 80 8-5m16 6 8-5m-30 17q16 14 29-2" fill="none" stroke="#262238" strokeWidth="3" strokeLinecap="round" /></g>
    <g transform="rotate(-8 182 287)"><rect x="75" y="264" width="218" height="48" rx="24" fill="#DDF28F" stroke="#262238" strokeWidth="2" /><text x="184" y="296" textAnchor="middle" fill="#262238" fontFamily="'Baloo 2', sans-serif" fontSize="23" fontWeight="700">Ek topic aur!</text></g>
  </svg>;
}
export default function StudyHero() {
  return <>
    <section className="study-hero" aria-labelledby="study-hero-title">
      <div className="study-hero-copy">
        <p className="hero-subject"><span aria-hidden="true" />Government exam preparation</p>
        <h1 id="study-hero-title">Bade sapne.<br />Roz ki taiyaari.</h1>
        <p className="hero-description">Apne goals ko ek clear next step dein. Learn a concept, revise your notes and practise at your pace — with your course materials in one place.</p>
        <div className="hero-actions"><a className="btn-primary gap-2" href="#catalog">Explore courses<ArrowUpRight size={18} aria-hidden="true" /></a><a className="hero-plan-link" href="#study-plan">Plan today’s study</a></div>
        <p className="hero-reassurance">Syllabus, language aur price pehle dekhein. Phir apna course chunein.</p>
      </div>
      <div className="study-hero-art"><div className="hero-art-caption"><span className="hero-art-dot" aria-hidden="true" />A little progress, every day.</div><StudyArtwork /><p className="hero-art-footer">Aapki mehnat. Aapka agla kadam.</p></div>
    </section>
    <div className="learning-toolkit" aria-label="Ways to learn">
      {[[BookOpen, "Concepts, made clearer", "Video and text lessons"], [FileText, "Revision, within reach", "Course PDF notes"], [ClipboardCheck, "Practice with purpose", "Quizzes and mock tests"]].map(([Icon, title, copy]) => <div className="toolkit-item" key={title}><span className="toolkit-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span><div><p>{title}</p><span>{copy}</span></div></div>)}
    </div>
  </>;
}
