import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Compass, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import WorkspaceIntro from "../components/WorkspaceIntro.jsx";
import CourseCard from "../components/CourseCard.jsx";
import { useSelector } from "react-redux";
import { errorMessage } from "../services/axiosInstance.js";
import { getCourses } from "../services/courseService.js";
export default function StudentDashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const [courses, setCourses] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setCourses(await getCourses()); setError(""); } catch (e) { setCourses([]); setError(errorMessage(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const unlocked = courses.filter((course) => course.access?.videos);
  const completed = unlocked.filter((course) => course.access?.status === "completed").length;
  const ready = unlocked.filter((course) => course.access?.status !== "completed").length;
  const stats = [{ label: "Courses on the platform", value: courses.length, icon: BookOpen }, { label: "Ready to continue", value: ready, icon: Compass }, { label: "Completed courses", value: completed, icon: CheckCircle2 }];
  return <section><WorkspaceIntro eyebrow="Aapki learning space" title={<>Aaj kya padhein, {user?.name?.split(" ")[0] || "student"}?</>}><p>Jahan chhoda tha, wahin se. Browse published courses and enroll in public courses. Private courses need an instructor assignment; paid materials open after verified payment.</p></WorkspaceIntro>
    <div className="mt-7 grid gap-3 sm:grid-cols-3">{stats.map(({ label, value, icon: Icon }) => <div className="card stat-card !p-5" key={label}><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><Icon size={19} className="text-primary-600 dark:text-primary-300" /></div><p className="mt-3 text-2xl font-semibold tabular-nums">{loading || error ? "—" : value}</p></div>)}</div>
    <div className="learning-workspace mt-7"><div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">All courses</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Open a course to view its details and check enrollment or payment.</p></div><button className="btn-secondary gap-2" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? "Refreshing…" : "Refresh courses"}</button></div>
    {loading && !error && <LoadingSkeleton label="Loading your courses…" />}{error && <p className="card mt-5 text-red-700 dark:text-red-300" role="alert">{error}</p>}
    {!loading && !error && <>{!courses.length && <div className="card mt-5 py-12 text-center"><BookOpen className="mx-auto text-primary-500" size={30} /><h3 className="mt-4 text-lg font-semibold">Courses will appear here</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">No courses have been published yet. Once an instructor publishes a course, it will show up here. Open a course to check its enrollment options.</p></div>}<div className="mt-5 grid gap-5 md:grid-cols-2">{courses.map((course) => <CourseCard key={course._id} course={course} status={course.access?.status} />)}</div></>}</div>
    <aside className="card h-fit"><p className="eyebrow">Ek chhota step</p><h2 className="mt-2 text-lg font-semibold">Chalo, aage badhein.</h2><ol className="workspace-steps mt-5"><li><span>01</span><div><h3>Browse the catalog</h3><p>Public courses offer enrollment from their course page. Private courses require an instructor assignment.</p></div></li><li><span>02</span><div><h3>Explore the materials</h3><p>After access is granted, watch the lessons and keep PDF notes nearby. Paid courses also need verified payment.</p></div></li><li><span>03</span><div><h3>Record your progress</h3><p>Mark each lesson complete when you are ready.</p></div></li></ol><Link className="btn-secondary mt-6 w-full justify-between gap-2" to="/courses">Browse all courses<ArrowRight size={16} /></Link></aside></div>
  </section>;
}
