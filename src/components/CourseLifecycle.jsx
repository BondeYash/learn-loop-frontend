import { useEffect, useRef, useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
export default function CourseLifecycle({ course, onChanged }) {
  const dialog = useRef(null); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const archived = Boolean(course.archivedAt);
  useEffect(() => { const element = dialog.current; if (open) element.showModal(); else element.close(); }, [open]);
  const save = async () => {
    setBusy(true); setError("");
    try { if (archived) await axiosInstance.post(`/courses/${course._id}/restore`); else await axiosInstance.delete(`/courses/${course._id}`); setOpen(false); await onChanged(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <><button className="btn-secondary gap-2" onClick={() => { setError(""); setOpen(true); }}>{archived ? <RotateCcw size={16} /> : <Archive size={16} />}{archived ? "Restore course" : "Archive course"}</button>
    <dialog ref={dialog} className="admin-dialog" aria-labelledby="course-lifecycle-title" onCancel={(e) => { e.preventDefault(); if (!busy) setOpen(false); }}>
      <h2 id="course-lifecycle-title" className="text-xl font-semibold">{archived ? "Restore" : "Archive"} this course?</h2><p className="mt-3 break-words font-medium">{course.title}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{archived ? "The course will return as a draft. Its lessons, videos, assignments and completion records are preserved. Review the content before publishing it again." : "This removes the course from students and stops new playback links. Existing video links may work until they expire. Lessons, files, assignments and completion records are kept so you can restore the course later."}</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><button className="btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : archived ? "Restore as draft" : "Archive course"}</button></div>
    </dialog>
  </>;
}
