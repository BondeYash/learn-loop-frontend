import { ArrowDown, ArrowUpRight, BookOpen, CheckCircle2, ClipboardCheck, FileText, MoveUpRight } from "lucide-react";
import { ActionLink } from "./Action.jsx";
import HeroPhotoSlider from "./HeroPhotoSlider.jsx";
import { coursePrice } from "../services/coursePrice.js";
import "./StudyHero.css";
export default function StudyHero({ featuredCourse, loading = false }) {
  return <>
    <section className="study-hero" aria-labelledby="study-hero-title">
      <div className="study-hero-copy"><p className="hero-subject hero-reveal"><span aria-hidden="true" />GOVERNMENT EXAMS. YOUR NEXT CHAPTER.</p><h1 id="study-hero-title" aria-label="Bade sapne. Roz ki taiyaari." className="hero-reveal">Bade sapne.<br /><span className="hero-highlight">Roz ki</span><br />taiyaari<span className="hero-period">.</span><MoveUpRight className="hero-heading-arrow" size={65} strokeWidth={1.5} aria-hidden="true" /></h1><p className="hero-description hero-reveal">Dream big. Start small. Learn a concept, take a mock, clear a doubt — and come back a little more confident.</p><div className="hero-actions hero-reveal">{featuredCourse ? <ActionLink className="btn-primary" to={`/catalog/${encodeURIComponent(featuredCourse.slug)}`}>Start learning · {coursePrice(featuredCourse.amountMinor)}<ArrowUpRight size={19} aria-hidden="true" /></ActionLink> : <a className="btn-primary" href="#catalog">Explore courses<ArrowUpRight size={19} aria-hidden="true" /></a>}<a className="hero-plan-link" href="#study-plan"><span className="plan-link-icon"><ArrowDown size={18} aria-hidden="true" /></span>Plan today’s study</a></div><p className="hero-reassurance hero-reveal"><CheckCircle2 size={16} aria-hidden="true" />One-time payment. Course access after verification.</p></div>
      <HeroPhotoSlider featuredCourse={featuredCourse} loading={loading} />
    </section>
    <div className="learning-toolkit" aria-label="Ways to learn">{[[BookOpen,"Concepts, made clearer","Video and text lessons"],[FileText,"Revision, within reach","Course PDF notes"],[ClipboardCheck,"Practice with purpose","Quizzes and mock tests"]].map(([Icon,title,copy],index)=><div className="toolkit-item" key={title}><span className="toolkit-index">0{index+1}</span><span className="toolkit-icon"><Icon size={25} strokeWidth={1.8} aria-hidden="true" /></span><div><p>{title}</p><span>{copy}</span></div></div>)}</div>
  </>;
}
