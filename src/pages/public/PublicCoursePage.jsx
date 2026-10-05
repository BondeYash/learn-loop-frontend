import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { LockKeyhole, Play } from "lucide-react";
import CoursePayment from "../../components/CoursePayment.jsx";
import { authLink } from "../../services/authReturn.js";
import CourseArtwork from "../../components/CourseArtwork.jsx";
import PrivateVideoPlayer from "../../components/PrivateVideoPlayer.jsx";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import { coursePrice } from "./PublicCatalogPage.jsx";

function Sample({ course, lesson }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || lesson.contentType !== "text") return;
    const controller = new AbortController(); setError(""); setText(null);
    axiosInstance.get(`/public/courses/${course.id}/preview`, { signal: controller.signal }).then((response) => { if (!controller.signal.aborted) setText(response.data.data.preview); }).catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [course.id, open, lesson.contentType, retry]);
  return <section className="card mt-6" id="sample"><p className="text-xs font-medium uppercase tracking-widest text-primary-700 dark:text-primary-300">Try a sample</p><h2 className="mt-3 text-xl font-semibold">{lesson.title}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This lesson is available to preview before signing in.</p>{!open ? <button className="btn-primary mt-5 gap-2" onClick={() => setOpen(true)}><Play size={16} />Open sample lesson</button> : <div className="mt-5">{lesson.contentType === "video" ? <PrivateVideoPlayer title={lesson.title} ticketPath={`/public/courses/${course.id}/preview`} ticketField="preview" /> : error ? <div role="alert"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setRetry((value) => value + 1)}>Retry sample</button></div> : text ? <p className="whitespace-pre-wrap break-words text-sm leading-7">{text.content}</p> : <p role="status">Loading sample lesson…</p>}</div>}</section>;
}
function Items({ title, items, empty }) { return <section className="card"><h2 className="text-xl font-semibold">{title}</h2>{items?.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{empty}</p>}</section>; }
export default function PublicCoursePage() {
  const { slug } = useParams(); const navigate = useNavigate(); const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(null), [error, setError] = useState(""), [retry, setRetry] = useState(0), [missing, setMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(""); setMissing(false);
    axiosInstance.get(`/public/courses/${encodeURIComponent(slug)}`, { signal: controller.signal }).then((response) => { if (!controller.signal.aborted) setData(response.data.data); }).catch((e) => { if (!controller.signal.aborted) { setError(errorMessage(e)); setMissing(e.response?.status === 404); } });
    return () => controller.abort();
  }, [slug, retry]);
  if (error) return <div className="card" role="alert"><h1 className="text-2xl font-semibold">{missing ? "Course unavailable" : "Unable to load this course"}</h1><p className="mt-3">{error}</p><div className="mt-5 flex flex-wrap gap-3"><Link className="btn-secondary" to="/catalog">Browse courses</Link>{!missing && <button className="btn-primary" onClick={() => setRetry((value) => value + 1)}>Retry course</button>}</div></div>;
  if (!data) return <p role="status" className="card">Loading course…</p>;
  const { course, modules } = data, sample = modules.flatMap((module) => module.lessons).find((lesson) => lesson.preview);
  const policies = Object.entries(course.policies || {}).filter(([, value]) => value);
  return <><Link className="text-sm text-primary-700 dark:text-primary-300" to="/catalog">← Browse courses</Link><div className="mt-6 grid items-start gap-7 lg:grid-cols-[1.6fr_1fr]">
    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-primary-700 dark:text-primary-300">{course.examName || course.category?.name || "Government-exam learning"}</p><h1 className="mt-3 break-words text-3xl font-semibold sm:text-5xl">{course.title}</h1>{course.summary && <p className="mt-4 text-lg leading-7 text-slate-600 dark:text-slate-300">{course.summary}</p>}<div className="mt-5 flex flex-wrap gap-3 text-sm"><span>{course.language || "Teaching language not provided"}</span><span className="capitalize">{course.level}</span><strong>{coursePrice(course.amountMinor)}</strong>{course.instructorName && <span>With {course.instructorName}</span>}</div>
      <section className="card mt-7"><h2 className="text-xl font-semibold">About this course</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{course.description}</p>{course.audience && <><h3 className="mt-6 font-semibold">Who it’s for</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{course.audience}</p></>}</section>
      {sample && <Sample key={`${course.id}-${sample.title}-${sample.contentType}`} course={course} lesson={sample} />}
      <div className="mt-6 grid gap-5 sm:grid-cols-2"><Items title="What you’ll learn" items={course.learningOutcomes} empty="The instructor has not provided learning outcomes yet." /><Items title="Before you start" items={course.requirements} empty="The instructor has not listed prerequisites." /></div>
      <section className="card mt-6"><h2 className="text-xl font-semibold">Course curriculum</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Explore the topics. Full lessons open when you have course access.</p>{modules.length ? <div className="mt-5 space-y-3">{modules.map((module, index) => <details key={index} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" open={index === 0}><summary className="cursor-pointer font-medium">{module.title} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">· {module.lessons.length} lessons</span></summary><ul className="mt-4 space-y-3">{module.lessons.map((lesson, n) => <li key={n} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{lesson.title}</span>{lesson.preview ? <a href="#sample" className="shrink-0 text-primary-700 underline dark:text-primary-300">Sample</a> : <LockKeyhole aria-label="Course access required" size={15} className="mt-1 shrink-0 text-slate-400" />}</li>)}</ul></details>)}</div> : <p className="mt-4 text-sm">No lesson outline has been provided.</p>}</section>
      {(course.instructorName || course.instructorBio) && <section className="card mt-6"><h2 className="text-xl font-semibold">Your instructor</h2>{course.instructorName && <h3 className="mt-3 font-semibold">{course.instructorName}</h3>}{course.instructorBio && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{course.instructorBio}</p>}</section>}
    </div>
    <aside className="card min-w-0 !p-0 overflow-hidden lg:sticky lg:top-6"><CourseArtwork course={course} className="aspect-video w-full" /><div className="p-5 sm:p-6"><p className="text-sm text-slate-500 dark:text-slate-400">Course price</p><p className="mt-2 text-3xl font-semibold">{coursePrice(course.amountMinor)}</p>{sample && <a href="#sample" className="btn-primary mt-5 w-full">Try the sample</a>}{user?.role === "student" ? <CoursePayment compact publicEnrollment courseId={course.id} onAccess={() => navigate(`/courses/${course.id}`)} /> : user ? <Link className="btn-secondary mt-4 w-full" to={`/courses/${course.id}`}>Preview course</Link> : <div className="mt-5"><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Sign in or create a student account to enroll. Paid courses open after verified payment.</p><Link className="btn-secondary mt-4 w-full" to={authLink("/login", `/catalog/${slug}`)}>Sign in to enroll</Link><Link className="mt-4 block text-center text-sm text-primary-700 underline dark:text-primary-300" to={authLink("/register", `/catalog/${slug}`)}>Create account</Link></div>}
      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700"><h2 className="font-semibold">Questions about the course?</h2>{course.support?.email || course.support?.url ? <div className="mt-3 space-y-2 text-sm">{course.support.email && <a className="block break-all text-primary-700 underline dark:text-primary-300" href={`mailto:${encodeURIComponent(course.support.email)}`}>{course.support.email}</a>}{course.support.url && <a className="block text-primary-700 underline dark:text-primary-300" href={course.support.url} target="_blank" rel="noopener noreferrer">Contact the course team</a>}</div> : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The instructor has not provided a public support contact yet.</p>}</div>
      {policies.length > 0 && <nav aria-label="Course policies" className="mt-5 flex flex-wrap gap-3 text-xs">{policies.map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline dark:text-primary-300">{({ terms: "Terms", privacy: "Privacy policy", refund: "Refund policy" })[name]}</a>)}</nav>}
    </div></aside>
  </div></>;
}
