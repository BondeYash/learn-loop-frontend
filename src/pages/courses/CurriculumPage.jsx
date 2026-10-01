import { useCallback, useEffect, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Video, Unlink, Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import VideoUpload from "../../components/VideoUpload.jsx";
import CourseAssignments from "../../components/CourseAssignments.jsx";
export default function CurriculumPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData((await axiosInstance.get(`/courses/mine/${id}`)).data.data); setError(""); } catch (e) { setError(errorMessage(e)); } }, [id]);
  useEffect(() => { load(); }, [load]);
  const mutate = async (operation, form) => {
    setBusy(true); setError("");
    try { await operation(); form?.reset(); await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <section><Link to="/instructor/courses" className="text-sm text-primary-600 dark:text-primary-300">← My courses</Link>{error && <div className="card mt-4 text-red-700 dark:text-red-300" role="alert">{error}<button className="ml-3 underline" onClick={load}>Reload course</button></div>}{!data ? <p className="mt-6" role="status">{error ? "Course unavailable." : "Loading curriculum…"}</p> : <>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{data.course.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.course.isPublished ? "Published" : "Draft"} · {data.modules.length} modules</p></div><div className="flex gap-3"><Link className="btn-secondary" to={`/courses/${id}`}>Preview course</Link><button disabled={busy} className="btn-primary" onClick={() => mutate(() => axiosInstance.patch(`/courses/${id}/publish`, { published: !data.course.isPublished }))}>{data.course.isPublished ? "Unpublish" : "Publish course"}</button></div></div>
    <p className="mt-4 text-slate-600 dark:text-slate-300">Add modules and video lessons, wait for each video to be ready, then publish and assign the course.</p>
    <form className="card mt-6 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate(() => axiosInstance.post(`/courses/${id}/modules`, { title: new FormData(form).get("title") }), form); }}><label className="flex-1 text-sm font-medium">New module title<input name="title" required maxLength={160} className="input-field mt-1" /></label><button disabled={busy} className="btn-primary">Add module</button></form>
    <div className="mt-8 space-y-7">{data.modules.map((module, moduleIndex) => <section className="card" key={module._id}>
      <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Module {String(moduleIndex + 1).padStart(2, "0")}</p><h2 className="mt-1 text-xl font-semibold">{module.title}</h2></div><span className="text-xs text-slate-500 dark:text-slate-400">{module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}</span></div>
      <div className="mt-6 space-y-3">{module.lessons.map((lesson, index) => <article key={lesson._id} className="lesson-row">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-[#303035] dark:text-slate-300"><Video size={18} strokeWidth={1.6} /></span><div className="min-w-0"><p className="text-[11px] font-medium text-slate-400">Lesson {String(index + 1).padStart(2, "0")}</p><h3 className="mt-0.5 break-words text-sm font-semibold sm:text-base">{lesson.title}</h3></div></div>
          <details className="lesson-actions relative shrink-0"><summary aria-label={`Actions for ${lesson.title}`} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#303035]"><MoreHorizontal size={20} /></summary><div className="lesson-menu">
            <button disabled={busy} onClick={(e) => { e.currentTarget.closest("details").removeAttribute("open"); const title = window.prompt("Lesson title", lesson.title); if (title?.trim()) mutate(() => axiosInstance.patch(`/courses/${id}/lessons/${lesson._id}`, { title: title.trim() })); }}><Pencil size={15} />Rename lesson</button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
            {lesson.video && <button className="destructive-action" disabled={busy} onClick={(e) => { e.currentTarget.closest("details").removeAttribute("open"); if (window.confirm("Remove this lesson’s video? Students will no longer be able to play it.")) mutate(() => axiosInstance.delete(`/uploads/${lesson.video._id}`)); }}><Unlink size={15} />Remove video</button>}
            <button className="destructive-action" disabled={busy} onClick={(e) => { e.currentTarget.closest("details").removeAttribute("open"); if (window.confirm(`Delete “${lesson.title}” and its video? This cannot be undone.`)) mutate(() => axiosInstance.delete(`/courses/${id}/lessons/${lesson._id}`)); }}><Trash2 size={15} />Delete lesson</button>
          </div></details>
        </div>
        {lesson.contentType === "video" ? <VideoUpload lesson={lesson} onChange={load} showRemoveControl={!lesson.video} /> : <p className="mt-3 text-sm text-slate-500">Text lesson</p>}
      </article>)}</div>
      <form className="mt-6 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate(() => axiosInstance.post(`/courses/${id}/modules/${module._id}/lessons`, { title: new FormData(form).get("title"), contentType: "video" }), form); }}><label className="min-w-0 flex-[1_1_200px] text-xs font-medium text-slate-500 dark:text-slate-400">New video lesson title<input required maxLength={160} name="title" placeholder="Give your next lesson a name" className="input-field mt-2" /></label><button disabled={busy} className="btn-secondary gap-2"><Plus size={15} />Add video lesson</button></form>
    </section>)}</div>
    <CourseAssignments courseId={id} published={data.course.isPublished} />
  </>}</section>;
}
