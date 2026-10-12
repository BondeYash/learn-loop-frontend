import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import StudentMotivation from "./StudentMotivation.jsx";
import ExamNotifications from "./ExamNotifications.jsx";

const questions = [
  ["How do I get access to a paid course?", "Sign in with a student account, choose your course and pay with Razorpay. Once payment is verified, the course opens automatically. You do not need to wait for instructor approval."],
  ["Can I see what’s inside before enrolling?", "Yes. Each course page shows its syllabus, language and price. If the instructor has added a public sample, you can try it before signing in."],
  ["Will my course include notes and mock tests?", "Resources vary by course. Check the course details before enrolling. Your course access includes the lessons, PDF notes, quizzes and mock tests that its instructor makes available."],
  ["Can I learn on my phone and return later?", "Yes. You can study on your phone or computer, revisit available lessons and see your saved learning progress after signing in."],
];

export default function LandingSections() {
  const user = useSelector(state => state.auth.user);
  return <>
    <ExamNotifications />
    <StudentMotivation />
    <section id="how-it-works" className="landing-guide" aria-labelledby="learning-guide-title">
      <div className="landing-section-heading"><div><p className="section-context">From your first step to your next chapter</p><h2 id="learning-guide-title">Taiyaari ko simple rakhein.</h2></div><p>A clear way to choose, join and learn.</p></div>
      <ol className="enrollment-steps">
        {[["Find your course", "Read the syllabus, check the language and try a sample where available."], ["Join and get access", "Pay for a paid course to unlock it automatically. Free courses follow their enrollment policy."], ["Build your routine", "Learn, revise and practise. Return to your course and keep your progress moving."]].map(([title, copy], index) => <li key={title}><span className="enrollment-step-number" aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}
      </ol>
    </section>
    <section className="landing-faq" aria-labelledby="landing-faq-title"><div><p className="section-context">Before you begin</p><h2 id="landing-faq-title">A few things<br />you might ask.</h2><p>So you can focus on learning.</p></div><div className="landing-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
    <section className="landing-next-step" aria-labelledby="next-step-title"><div><p>Kal ka confidence, aaj ki practice se.</p><h2 id="next-step-title">Apna agla chapter shuru karein.</h2></div><div><a className="btn-primary gap-2" href="#catalog">Explore courses<ArrowUpRight size={18} aria-hidden="true" /></a><Link className="landing-account-link" to={user ? "/dashboard" : "/register"}>{user ? "Go to dashboard" : "Create a student account"}</Link></div></section>
  </>;
}
