import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Video, Unlink } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import NewLessonForm from "../../components/NewLessonForm.jsx";
import TextLessonEditor from "../../components/TextLessonEditor.jsx";
import VideoUpload from "../../components/VideoUpload.jsx";
import CourseAssignments from "../../components/CourseAssignments.jsx";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import CourseNotes from "../../components/CourseNotes.jsx";
import CourseLifecycle from "../../components/CourseLifecycle.jsx";
import LessonActions from "../../components/LessonActions.jsx";
import CourseThumbnail from "../../components/CourseThumbnail.jsx";
import { useDecision } from "../../components/DecisionProvider.jsx";
import { useSelector } from "react-redux";
export default function CurriculumPage() {
  const { id } = useParams();
  const decide = useDecision();
  const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData((await axiosInstance.get(`/courses/mine/${id}`)).data.data); setError(""); } catch (e) { setError(errorMessage(e)); } }, [id]);
  useEffect(() => { load(); }, [load]);
  const mutate = async (operation, form) => {
    setBusy(true); setError("");
    try { await operation(); form?.reset(); await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  if (data?.course.archivedAt) return <section><Link to={isAdmin ? "/admin?tab=courses" : "/instructor/courses"} className="text-sm text-primary-600 dark:text-primary-300">← Back to courses</Link><div className="card mt-6"><p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">Archived course</p><h1 className="mt-3 text-3xl font-semibold">{data.course.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Students cannot access this course. Its lessons, files, assignments and completion records are preserved. Restore it to review the content before reopening student access.</p><div className="mt-6"><CourseLifecycle course={data.course} onChanged={load} /></div>{error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}</div></section>;
  return <section><Link to={isAdmin ? "/admin?tab=courses" : "/instructor/courses"} className="text-sm text-primary-600 dark:text-primary-300">← {isAdmin ? "All courses" : "My courses"}</Link>{error && <div className="card mt-4 text-red-700 dark:text-red-300" role="alert">{error}<button className="ml-3 underline" onClick={load}>Reload course</button></div>}{!data ? error ? <p className="mt-6">Course unavailable.</p> : <LoadingSkeleton variant="detail" label="Loading course content…" /> : <>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{data.course.title}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.course.isPublished ? "Visible to all students. Videos open for assigned students" : "Not visible to students yet"} · {data.modules.length} modules</p></div><div className="flex flex-wrap gap-3"><Link className="btn-secondary" to={`/instructor/courses/${id}/edit`}>Edit details</Link><Link className="btn-secondary" to={`/courses/${id}`}>Preview course</Link><a className="btn-primary" href="#assign-students">Choose students</a></div></div>
    <p className="mt-4 text-slate-600 dark:text-slate-300">Add video or text lessons and PDF notes, then assign students below.</p>
    <div className="card mt-5"><h2 className="font-semibold">Enrollment policy: {data.course.visibility === "public" ? "Public" : "Instructor assignment"}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data.course.visibility === "public" ? data.course.isPublished ? "Visitors can see course details and the selected sample. Self-enrollment is available when materials are ready." : "Publish this course when its details and learning materials are ready. A public sample is optional." : "Published course details appear in the public catalog. Students need an instructor assignment; full materials remain protected."}</p>{data.course.isPublished && <Link className="btn-secondary mt-3" to={`/catalog/${data.course.slug}`}>View public course page</Link>}<Link className="mt-3 block text-sm text-primary-700 underline dark:text-primary-300" to={`/instructor/courses/${id}/edit`}>Edit public details and sample</Link></div>
    <section className="card mt-6"><h2 className="text-xl font-semibold">Sources and course interest</h2><p className="mt-3 text-sm leading-7 text-muted">Review recorded enrollment activity, optional source links and private interest requests.</p><Link className="btn-secondary mt-4" to={`/instructor/courses/${id}/acquisition`}>Manage course acquisition</Link></section>
    <section className="card mt-6"><h2 className="text-xl font-semibold">Practical tasks and private questions</h2><p className="mt-3 text-sm leading-7 text-muted">Author task instructions, review self-reported text responses and reply to student questions.</p><Link className="btn-secondary mt-4" to={`/instructor/courses/${id}/support`}>Manage learning support</Link></section>
    <CourseThumbnail course={data.course} onChanged={load} />
    <section className="card mt-6"><h2 className="text-xl font-semibold">Chapter quizzes and mock tests</h2><p className="mt-3 text-sm leading-7 text-muted">Apne reviewed sawaal add karein. Assessment drafts stay private until you publish them; course access still applies.</p><Link className="btn-secondary mt-4" to={`/instructor/courses/${id}/assessments`}>Manage assessments</Link></section>
    <details className="card mt-6"><summary className="cursor-pointer text-sm font-medium">Organize into modules (optional)</summary><form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate(() => axiosInstance.post(`/courses/${id}/modules`, { title: new FormData(form).get("title") }), form); }}><label className="min-w-0 flex-[1_1_180px] text-sm font-medium">New module title<input name="title" required maxLength={160} className="input-field mt-1" /></label><button disabled={busy} className="btn-secondary">Add module</button></form></details>
    <div className="mt-8 space-y-7">{data.modules.map((module, moduleIndex) => <section className="card" key={module._id}>
      <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Module {String(moduleIndex + 1).padStart(2, "0")}</p><h2 className="mt-1 text-xl font-semibold">{module.title}</h2></div><span className="text-xs text-slate-500 dark:text-slate-400">{module.lessons.length} {module.lessons.length === 1 ? "lesson" : "lessons"}</span></div>
      <div className="mt-6 space-y-3">{module.lessons.map((lesson, index) => <article key={lesson._id} className="lesson-row">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Video size={18} strokeWidth={1.6} /></span><div className="min-w-0"><p className="text-[11px] font-medium text-muted">Lesson {String(index + 1).padStart(2, "0")}</p><h3 className="mt-0.5 break-words text-sm font-semibold sm:text-base">{lesson.title}</h3></div></div>
          <LessonActions title={lesson.title}>
            <button disabled={busy} onClick={async (e) => { e.currentTarget.closest("details").removeAttribute("open"); if (await decide({ title: "Rename lesson", body: "Choose the title students see in the lesson outline.", inputLabel: "Lesson title", initialValue: lesson.title, confirmLabel: "Save lesson title", onConfirm: (title) => axiosInstance.patch(`/courses/${id}/lessons/${lesson._id}`, { title }) })) await load(); }}><Pencil size={15} />Rename lesson</button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
            {lesson.video && <button className="destructive-action" disabled={busy} onClick={async (e) => { e.currentTarget.closest("details").removeAttribute("open"); if (await decide({ title: "Remove this video?", body: "Students will no longer be able to play this lesson’s video.", destructive: true, confirmLabel: "Remove video", onConfirm: () => axiosInstance.delete(`/uploads/${lesson.video._id}`) })) await load(); }}><Unlink size={15} />Remove video</button>}
            <button className="destructive-action" disabled={busy} onClick={async (e) => { e.currentTarget.closest("details").removeAttribute("open"); if (await decide({ title: "Delete this lesson?", body: `“${lesson.title}” and its video will be removed. This cannot be undone.`, destructive: true, confirmLabel: "Delete lesson", onConfirm: () => axiosInstance.delete(`/courses/${id}/lessons/${lesson._id}`) })) await load(); }}><Trash2 size={15} />Delete lesson</button>
          </LessonActions>
        </div>
        {lesson.contentType === "video" ? <VideoUpload lesson={lesson} onChange={load} showRemoveControl={!lesson.video} /> : lesson.contentType === "text" ? <TextLessonEditor key={lesson._id} courseId={id} lesson={lesson} onChanged={load} /> : <p className="mt-3 text-sm text-slate-500">PDF lesson</p>}
      </article>)}</div>
      <NewLessonForm courseId={id} moduleId={module._id} busy={busy} mutate={mutate} />
    </section>)}</div>
    <CourseNotes courseId={id} management onChanged={load} />
    <CourseAssignments courseId={id} published={data.course.isPublished} onChanged={load} />
    <details className="card mt-6"><summary className="cursor-pointer text-sm font-medium">Access and archive controls</summary><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Publishing lists course details in the public and signed-in catalogs. The Public enrollment policy also enables self-enrollment and the selected sample. Instructor assignments and verified payment still control full learning access. Hiding removes the public page without deleting assignments.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className="btn-secondary" onClick={() => mutate(() => axiosInstance.patch(`/courses/${id}/publish`, { published: !data.course.isPublished }))}>{data.course.isPublished ? "Hide from students" : "Publish course"}</button><CourseLifecycle course={data.course} onChanged={load} /></div></details>
  </>}</section>;
}
