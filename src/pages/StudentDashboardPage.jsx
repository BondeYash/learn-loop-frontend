import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Play, RefreshCw } from "lucide-react";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { useSelector } from "react-redux";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
export default function StudentDashboardPage() {
  const user = useSelector((state) => state.auth.user);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setEnrollments((await axiosInstance.get("/enrollments/me")).data.data.enrollments); setError(""); } catch (e) { setEnrollments([]); setError(errorMessage(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const completed = enrollments.filter((item) => item.status === "completed").length;
  return <section><div className="learning-intro"><p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Your learning space</p><h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Keep learning, {user?.name?.split(" ")[0] || "student"}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">Your instructors have brought the lessons here. Choose an assigned course and take the next step.</p><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-2"><BookOpen size={17} />{enrollments.length} assigned</span><span className="inline-flex items-center gap-2"><CheckCircle2 size={17} />{completed} completed</span></div></div>
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Your assigned courses</h2><button className="btn-secondary gap-2" onClick={load} disabled={loading}><RefreshCw size={15} />{loading ? "Refreshing…" : "Refresh courses"}</button></div>
    {loading && !error && <LoadingSkeleton label="Loading your courses…" />}{error && <p className="card mt-5 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300" role="alert">{error}</p>}
    {!loading && !error && <>{!enrollments.length && <div className="card mt-5 py-10 text-center"><BookOpen className="mx-auto text-primary-400" size={30} /><h3 className="mt-4 text-lg font-semibold">Your courses will appear here</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">No published courses are assigned to you yet. Ask your instructor to assign a course to your registered email address.</p></div>}<div className="mt-5 grid gap-5 md:grid-cols-2">{enrollments.map(({ _id, course, status }) => <article className="card flex flex-col" key={_id}><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-300"><BookOpen size={22} /></span><span className={`rounded-full px-3 py-1 text-xs font-medium ${status === "completed" ? "bg-green-50 dark:bg-emerald-950 text-green-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>{status === "completed" ? "Completed" : "Ready to learn"}</span></div><h3 className="mt-5 text-xl font-bold">{course.title}</h3><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">By {course.instructor?.name}</p><p className="mt-3 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{course.description}</p><Link className="btn-primary mt-6 gap-2 self-start" to={`/courses/${course._id}`}><Play size={16} />Open course</Link></article>)}</div></>}
  </section>;
}
