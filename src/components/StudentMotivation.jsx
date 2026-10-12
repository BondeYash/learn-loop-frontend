import { useState } from "react";
import { ArrowUpRight, BookOpen, Check, Clock3, FileText, PencilLine, Sprout } from "lucide-react";

const routines = {
  15: [5, 5, 5],
  30: [15, 5, 10],
  60: [25, 15, 20],
};
const steps = [
  { icon: BookOpen, title: "Ek concept samjho", copy: "Choose one topic from your syllabus." },
  { icon: FileText, title: "Notes se dohrao", copy: "Recall the key points, then check your notes." },
  { icon: PencilLine, title: "Practice, phir review", copy: "Try questions and revisit what you missed." },
];

export default function StudentMotivation() {
  const [minutes, setMinutes] = useState(30);
  return <section id="study-plan" className="student-motivation" aria-labelledby="motivation-title">
    <div className="motivation-copy">
      <span className="motivation-mark" aria-hidden="true"><Sprout size={34} strokeWidth={1.6} /></span>
      <p className="section-context">For the days when it feels difficult</p>
      <h2 id="motivation-title">Har din thoda.<br />Har din aage.</h2>
      <p className="motivation-message">Ek mock test aapki poori kahaani nahi hai. Galti samjhein, topic revise karein, aur dobara koshish karein.</p>
      <p className="motivation-support">You don’t have to finish everything today. Start with one topic you can understand a little better.</p>
      <div className="motivation-reminder"><Check size={18} aria-hidden="true" /><span>Chhota target. Poora focus. Phir ek break.</span></div>
    </div>
    <div className="study-routine">
      <div className="routine-heading"><span className="routine-clock" aria-hidden="true"><Clock3 size={23} /></span><div><h3>Aaj ka chhota target</h3><p>How much time do you have?</p></div></div>
      <div className="routine-options" role="group" aria-label="Study time">
        {Object.keys(routines).map(value => <button key={value} type="button" aria-pressed={minutes === Number(value)} onClick={() => setMinutes(Number(value))}>{value} min</button>)}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="routine-total">Your {minutes}-minute study plan</p>
        <ol className="routine-steps">{steps.map(({ icon: Icon, title, copy }, index) => <li key={title}><span className={`routine-step-icon routine-step-${index}`} aria-hidden="true"><Icon size={21} strokeWidth={1.7} /></span><div><h4>{title}</h4><p>{copy}</p></div><span className="routine-time">{routines[minutes][index]}<small>min</small></span></li>)}</ol>
      </div>
      <a className="routine-start" href="#catalog">Find a course to start<ArrowUpRight size={18} aria-hidden="true" /></a>
      <p className="routine-note">A suggested routine. Adjust it to your syllabus and energy.</p>
    </div>
  </section>;
}
