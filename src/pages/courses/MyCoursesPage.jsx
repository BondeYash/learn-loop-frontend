import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import CourseCard from "../../components/CourseCard.jsx";
import { getMyCourses } from "../../services/courseService.js";
import { errorMessage } from "../../services/axiosInstance.js";
export default function MyCoursesPage() {
  const [archived, setArchived] = useState(false);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setCourses(await getMyCourses(archived)); setError(""); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }, [archived]);
  useEffect(() => { load(); }, [load]);
  const published = courses.filter((course) => course.isPublished).length;
  return <section><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Instructor workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">My courses</h1><p className="mt-4 max-w-xl text-base leading-7 text-slate-500 dark:text-slate-400">Upload lessons, publish your course, and choose who can learn from it.</p></div><Link className="btn-primary gap-2 self-center" to="/instructor/courses/new"><Plus size={18} />Create course</Link></div>
    <div className="mt-8 flex gap-2"><button className="btn-secondary" aria-pressed={!archived} onClick={() => setArchived(false)}>Active courses</button><button className="btn-secondary" aria-pressed={archived} onClick={() => setArchived(true)}>Archived courses</button></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500 dark:text-slate-400">{courses.length} {archived ? "archived" : "active"} courses · {published} published</p><button className="btn-secondary gap-2" disabled={loading} onClick={load}><RefreshCw size={16} />{loading ? "Refreshing…" : "Refresh"}</button></div>
    {error && <p className="card mt-5 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300" role="alert">{error} Use Refresh to try again.</p>}
    {loading && !courses.length && <p className="card mt-5" role="status">Loading your courses…</p>}
    {!loading && !error && !courses.length && <div className="card mt-5 py-12 text-center"><BookOpen className="mx-auto text-primary-500" size={32} /><h2 className="mt-4 text-xl font-bold">{archived ? "No archived courses" : "Your first course starts here"}</h2><p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-300">{archived ? "Courses you archive are kept here for recovery." : "Create a draft, add a module and a video lesson, then assign the published course to your students."}</p><Link className="btn-primary mt-5" to="/instructor/courses/new">Create your first course</Link></div>}
    <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CourseCard management key={course._id} course={course} />)}</div>
  </section>;
}
