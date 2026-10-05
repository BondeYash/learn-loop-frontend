import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance, { errorMessage } from "./axiosInstance.js";
export function useLearningPlace({ lessonId, courseId, enabled, progress }) {
  const initial = useRef(progress); initial.current = progress;
  const report = useRef(null), retryAction = useRef(null);
  const [placeError, setPlaceError] = useState("");
  useEffect(() => {
    setPlaceError(""); if (!enabled || !lessonId) { report.current = null; retryAction.current = null; return; }
    const controller = new AbortController(); let revision = initial.current.resumeRevision || 0, queued = initial.current.resume && String(initial.current.resume.lesson) === lessonId ? initial.current.resume.position || 0 : 0, saving = false, stopped = false;
    const save = async (first = false) => {
      if (saving || stopped || controller.signal.aborted) return; saving = true; const position = Math.floor(queued);
      try {
        let result;
        try { result = await axiosInstance.post(`/lessons/${lessonId}/visit`, { position, revision, requestId: crypto.randomUUID() }, { signal: controller.signal }); }
        catch (e) { if (!first || e.response?.status !== 409) throw e; const fresh = await axiosInstance.get(`/courses/${courseId}/progress`, { signal: controller.signal }); revision = fresh.data.data.progress.resumeRevision || 0; result = await axiosInstance.post(`/lessons/${lessonId}/visit`, { position, revision, requestId: crypto.randomUUID() }, { signal: controller.signal }); }
        if (!controller.signal.aborted) { revision = result.data.data.progress.resumeRevision; setPlaceError(""); }
      } catch (e) { if (e.code !== "ERR_CANCELED") { stopped = true; setPlaceError(errorMessage(e)); } }
      finally { saving = false; if (!controller.signal.aborted && !stopped && queued !== position) save(); }
    };
    report.current = (position) => { if (Number.isFinite(position)) { queued = Math.max(0, Math.min(14400, Math.floor(position))); save(); } };
    retryAction.current = async () => { if (saving) return; try { const fresh = await axiosInstance.get(`/courses/${courseId}/progress`, { signal: controller.signal }); if (controller.signal.aborted) return; revision = fresh.data.data.progress.resumeRevision || 0; stopped = false; save(); } catch (e) { if (e.code !== "ERR_CANCELED") setPlaceError(errorMessage(e)); } };
    save(true);
    return () => { controller.abort(); report.current = null; retryAction.current = null; };
  }, [lessonId, courseId, enabled]);
  return { savePosition: useCallback((position) => report.current?.(position), []), retryPlace: useCallback(() => retryAction.current?.(), []), placeError };
}
