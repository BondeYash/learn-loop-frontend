import { useCallback, useEffect, useState } from "react";
import CourseCard from "../../components/CourseCard.jsx";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import { getCourses } from "../../services/courseService.js";
import { errorMessage } from "../../services/axiosInstance.js";
export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCourses(await getCourses()); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <section><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">All courses</h1><button className="btn-secondary" disabled={loading} onClick={load}>Refresh courses</button></div><p className="mt-2 text-slate-500 dark:text-slate-400">Every published course is listed here. Videos open after that course’s instructor gives your account access.</p>
    {loading && !courses.length && <LoadingSkeleton />}
    {error && <div className="card mt-6" role="alert"><p className="text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-3" onClick={load} disabled={loading}>Retry courses</button></div>}
    {!error && <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{courses.map((course) => <CourseCard key={course._id} course={course} />)}</div>}
    {!loading && !error && !courses.length && <p className="card mt-8 text-slate-500 dark:text-slate-400">No published courses yet.</p>}
  </section>;
}
