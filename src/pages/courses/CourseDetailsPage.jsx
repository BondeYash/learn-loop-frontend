import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import PrivateVideoPlayer from "../../components/PrivateVideoPlayer.jsx";
import { getCourse } from "../../services/courseService.js";
export default function CourseDetailsPage() {
  const { id } = useParams();
  const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [progress, setProgress] = useState({ completedLessons: [] });
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await getCourse(id);
      setData(result); setError("");
      const lessons = result.modules.flatMap((module) => module.lessons);
      setSelected((current) => lessons.some((lesson) => lesson._id === current) ? current : lessons[0]?._id || null);
      if (user.role === "student") setProgress((await axiosInstance.get(`/courses/${result.course._id}/progress`)).data.data.progress);
    } catch (e) { setData(null); setError(errorMessage(e)); }
  }, [id, user.role]);
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  const lesson = data?.modules.flatMap((module) => module.lessons).find((item) => item._id === selected);
  const ready = lesson?.video?.status === "ready";
  const markComplete = async () => {
    setSaving(true);
    try { setProgress((await axiosInstance.post(`/lessons/${lesson._id}/complete`)).data.data.progress); setPlayError(""); }
    catch (e) { setPlayError(errorMessage(e)); } finally { setSaving(false); }
  };
  return <section><Link className="text-sm text-primary-600 dark:text-primary-300" to="/dashboard">← Dashboard</Link>{error && <div className="card mt-5" role="alert"><p className="text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-4" onClick={load}>Retry course</button></div>}{!data ? !error && <p className="mt-8" role="status">Loading course…</p> : <>
    <h1 className="mt-4 text-3xl font-bold">{data.course.title}</h1><p className="mt-3 text-slate-600 dark:text-slate-300">{data.course.description}</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">By {data.course.instructor?.name}{user.role === "student" ? ` · ${progress.percentage || 0}% complete` : " · Instructor preview"}</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0"><h2 className="mb-3 text-xl font-semibold">{lesson?.title || "No lessons yet"}</h2>
      {ready && <PrivateVideoPlayer key={lesson._id} lessonId={lesson._id} title={lesson.title} />}
      {lesson?.contentType === "video" && !ready && <div className="card" role="status">{lesson.video?.status === "verifying" ? "The uploaded MP4 is being checked. This page will update when it is ready." : lesson.video?.status === "failed" ? "The upload could not be verified. Your instructor can check the upload or replace it with a valid MP4." : lesson.video?.status === "queued" ? "This older upload is queued for server processing. Your instructor may need to replace it with a preconverted MP4." : lesson.video?.status === "processing" ? "This older upload is being processed." : "The instructor has not finished uploading this lesson’s video yet."}</div>}
      {lesson?.contentType === "text" && <div className="card whitespace-pre-wrap">{lesson.content}</div>}
      {playError && <div className="card mt-4" role="alert"><p className="text-red-700 dark:text-red-300">{playError}</p><button className="btn-secondary mt-3" onClick={async () => { await load(); setPlayError("");  }}>Retry playback</button></div>}
      {user.role === "student" && lesson && (ready || lesson.contentType === "text") && <button disabled={saving || progress.completedLessons.includes(lesson._id)} className="btn-primary mt-5" onClick={markComplete}>{progress.completedLessons.includes(lesson._id) ? "Lesson completed" : saving ? "Saving…" : "Mark lesson complete"}</button>}
      {ready && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Use the player controls for playback speed, volume, seeking, and full screen.</p>}
    </section><nav className="card h-fit" aria-label="Course lessons"><h2 className="text-lg font-semibold">Curriculum</h2>{data.modules.map((module) => <div className="mt-5" key={module._id}><h3 className="font-medium">{module.title}</h3><ul className="mt-2 space-y-2">{module.lessons.map((item) => <li key={item._id}><button aria-current={selected === item._id ? "true" : undefined} className={`w-full rounded-lg p-3 text-left text-sm ${selected === item._id ? "bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`} onClick={() => { setSelected(item._id); setPlayError("");  }}>{progress.completedLessons.includes(item._id) ? "✓ " : ""}{item.title}</button></li>)}</ul></div>)}</nav></div>
  </>}</section>;
}
