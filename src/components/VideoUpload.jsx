import { CheckCircle2, UploadCloud, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDecision } from "./DecisionProvider.jsx";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { uploadVideo } from "../services/videoUpload.js";
export default function VideoUpload({ lesson, onChange, showRemoveControl = true }) {
  const decide = useDecision();
  const [video, setVideo] = useState(lesson.video);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const controller = useRef(null);
  useEffect(() => { setVideo(lesson.video); }, [lesson.video]);
  useEffect(() => () => controller.current?.abort(), []);
  const videoId = video?._id;
  const videoStatus = video?.status;
  useEffect(() => {
    if (!videoId || !["queued", "processing", "verifying"].includes(videoStatus)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try { const { data } = await axiosInstance.get(`/uploads/${videoId}`); if (cancelled) return; setVideo(data.data.video); setMessage(""); if (["ready", "failed"].includes(data.data.video.status)) onChange(); }
      catch (error) { if (!cancelled) setMessage(`Cannot check processing: ${errorMessage(error)}. Retrying…`); }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [videoId, videoStatus, onChange]);
  const select = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    controller.current = new AbortController();
    setBusy(true); setMessage(""); setProgress(0); setStage("Preparing file…");
    try { setVideo(await uploadVideo(lesson._id, file, { signal: controller.current.signal, onProgress: setProgress, onVideo: (next) => setVideo(next), onStage: setStage })); onChange(); }
    catch (error) { setMessage(controller.current.signal.aborted ? "Upload stopped. Select the same MP4 to retry. The transfer restarts from the beginning." : errorMessage(error)); }
    finally { setBusy(false); controller.current = null; }
  };
  const action = async (remove) => {
    setBusy(true); setMessage("");
    try {
      if (remove) { await axiosInstance.delete(`/uploads/${video._id}`); setVideo(null); }
      else setVideo((await axiosInstance.post(video.uploadMode === "direct" ? `/direct-uploads/${video._id}/complete` : `/uploads/${video._id}/complete`, {}, { timeout: 120000 })).data.data.video);
      onChange();
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  };
  return <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
    <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${video?.status === "ready" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : video?.status === "failed" ? "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300" : "bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"}`} role="status">{video?.status === "ready" ? <CheckCircle2 size={14} /> : ["queued", "processing", "verifying"].includes(video?.status) ? <LoaderCircle size={14} className="animate-spin" /> : <UploadCloud size={14} />}{video?.status === "ready" ? "Ready to play" : video?.status === "uploading" ? "Upload in progress" : video?.status === "queued" ? "Queued" : video?.status === "verifying" ? "Checking file" : video?.status === "processing" ? "Processing" : video?.status === "failed" ? "Needs attention" : "No video yet"}</span>{video?.filename && <span className="min-w-0 break-all text-xs text-slate-500 dark:text-slate-400">{video.filename}{video.size ? ` · ${(video.size / 1048576).toFixed(1)} MB` : ""}</span>}</div>
    {(!video || ["uploading", "failed"].includes(video.status)) && <label className="mt-3 block text-sm">{video ? "Select the same MP4 to retry" : "Choose an MP4 video"}<input aria-label={`Video for ${lesson.title}`} className="mt-2 block w-full" type="file" accept=".mp4,video/mp4" disabled={busy} onChange={select} /><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Precompressed H.264/AAC MP4 · up to 2 GB and 4 hours. Convert WebM, MOV or MKV to MP4 before uploading. The first-frame check does not verify the audio codec. Preview the video with sound before sharing; the server checks the container and file metadata. Keep this page open during transfer. Retrying restarts the file.</span></label>}
    {busy && controller.current && <div className="mt-3"><progress aria-label="Video upload progress" className="w-full" value={progress} max="100" /><p className="text-sm" role="status">{stage.includes("Uploading") ? `Uploading ${progress}% directly to private storage` : stage}</p><button className="btn-secondary mt-2" onClick={() => controller.current?.abort()}>Cancel transfer</button></div>}
    {["queued", "processing", "verifying"].includes(video?.status) && <p className="mt-2 text-sm">{video?.uploadMode === "direct" ? "Upload received. Checking the file in private storage…" : "This is an older server-processed upload. Replace it with a preconverted MP4 if processing is unavailable."}</p>}
    {video?.error && <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{video.error}</p>}
    {message && <p className="mt-2 text-sm" role="status">{message}</p>}
    {video?.uploadMode === "direct" && ["uploading", "failed", "verifying"].includes(video.status) && <button className="btn-secondary mt-3" disabled={busy} onClick={() => action(false)}>Check uploaded file</button>}
    {showRemoveControl && video && !busy && <button className="ml-3 mt-3 text-sm text-red-700 dark:text-red-300 underline" onClick={async () => { if (await decide({ title: "Remove this video?", body: "Students will no longer be able to play this lesson’s video.", destructive: true, confirmLabel: "Remove video", onConfirm: () => axiosInstance.delete(`/uploads/${video._id}`) })) { setVideo(null); onChange(); } }}>Remove video</button>}
  </div>;
}
