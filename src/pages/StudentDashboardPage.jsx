import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Compass, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import CourseCard from "../components/CourseCard.jsx";
import { useSelector } from "react-redux";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
export default function StudentDashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const [enrollments, setEnrollments] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setEnrollments((await axiosInstance.get("/enrollments/me")).data.data.enrollments); setError(""); } catch (e) { setEnrollments([]); setError(errorMessage(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const completed = enrollments.filter((item) => item.status === "completed").length;
  const stats = [{ label: "Assigned courses", value: enrollments.length, icon: BookOpen }, { label: "Ready to continue", value: enrollments.length - completed, icon: Compass }, { label: "Completed courses", value: completed, icon: CheckCircle2 }];
  return <section><div className="learning-intro"><p className="eyebrow">Your learning space</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Keep learning, {user?.name?.split(" ")[0] || "student"}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Every lesson is a step forward. Your assigned courses and materials are ready when you are.</p></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-3">{stats.map(({ label, value, icon: Icon }) => <div className="card stat-card !p-5" key={label}><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><Icon size={19} className="text-primary-600 dark:text-primary-300" /></div><p className="mt-3 text-2xl font-semibold tabular-nums">{loading || error ? "—" : value}</p></div>)}</div>
    <div className="learning-workspace mt-7"><div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Your assigned courses</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Pick up where your next lesson begins.</p></div><button className="btn-secondary gap-2" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? "Refreshing…" : "Refresh courses"}</button></div>
    {loading && !error && <LoadingSkeleton label="Loading your courses…" />}{error && <p className="card mt-5 text-red-700 dark:text-red-300" role="alert">{error}</p>}
    {!loading && !error && <>{!enrollments.length && <div className="card mt-5 py-12 text-center"><BookOpen className="mx-auto text-primary-500" size={30} /><h3 className="mt-4 text-lg font-semibold">Your courses will appear here</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">No published courses are assigned to you yet. Ask your instructor to assign a course to your registered email address.</p></div>}<div className="mt-5 grid gap-5 md:grid-cols-2">{enrollments.map(({ _id, course, status }) => <CourseCard key={_id} course={course} status={status} />)}</div></>}</div>
    <aside className="card h-fit"><p className="eyebrow">A little guidance</p><h2 className="mt-2 text-lg font-semibold">Make room for your next step.</h2><ol className="workspace-steps mt-5"><li><span>01</span><div><h3>Choose a course</h3><p>Your instructor selects the courses available to you.</p></div></li><li><span>02</span><div><h3>Explore the materials</h3><p>Watch the lessons and keep PDF notes nearby.</p></div></li><li><span>03</span><div><h3>Record your progress</h3><p>Mark each lesson complete when you are ready.</p></div></li></ol><Link className="btn-secondary mt-6 w-full justify-between gap-2" to="/courses">View all assigned courses<ArrowRight size={16} /></Link></aside></div>
  </section>;
}
