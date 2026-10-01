import { useCallback, useEffect, useRef, useState } from "react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
export default function PrivateVideoPlayer({ lessonId, title }) {
  const player = useRef(null);
  const resume = useRef({ time: 0, playing: false });
  const pending = useRef(null);
  const automaticRetries = useRef(0);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [buffering, setBuffering] = useState(true);
  const renew = useCallback(async (preserve = true) => {
    if (pending.current) return;
    if (preserve && player.current) resume.current = { time: player.current.currentTime || 0, playing: !player.current.paused };
    const controller = new AbortController(); pending.current = controller;
    setBuffering(true); setError("");
    try {
      const response = await axiosInstance.get(`/lessons/${lessonId}/playback`, { signal: controller.signal });
      if (!controller.signal.aborted) setTicket(response.data.data);
    } catch (e) {
      if (!controller.signal.aborted) { player.current?.pause(); setTicket(null); setBuffering(false); setError(errorMessage(e)); }
    } finally { if (pending.current === controller) pending.current = null; }
  }, [lessonId]);
  useEffect(() => {
    renew(false);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [renew]);
  useEffect(() => {
    if (!ticket) return;
    const timer = setTimeout(() => renew(), Math.max(1000, ticket.expiresAt - Date.now() - 30000));
    return () => clearTimeout(timer);
  }, [ticket, renew]);
  const failed = () => {
    setBuffering(false);
    if (automaticRetries.current++ < 1) renew();
    else setError("Playback failed. Check your connection and retry. The file must use codecs supported by your browser; H.264/AAC MP4 is recommended.");
  };
  return <div>
    {ticket && <div className="relative overflow-hidden rounded-2xl bg-black"><video key={ticket.expiresAt} ref={player} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black" aria-label={title} src={ticket.url}
      onLoadStart={() => setBuffering(true)} onCanPlay={() => setBuffering(false)} onPlaying={() => setBuffering(false)} onWaiting={() => setBuffering(true)} onError={failed}
      onSeeking={() => { if (Date.now() > ticket.expiresAt - 15000) renew(); }}
      onLoadedMetadata={(event) => { const video = event.currentTarget; video.currentTime = Math.min(resume.current.time, Math.max(0, video.duration - 0.1)); if (resume.current.playing) video.play().catch(() => {}); }}>
      Your browser does not support HTML5 video.
    </video>{buffering && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30"><span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white" role="status">Loading video…</span></div>}</div>}
    {!ticket && !error && <p className="card" role="status">Loading private video…</p>}
    {error && <div className="card mt-3" role="alert"><p className="text-sm text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-3" onClick={() => { automaticRetries.current = 0; renew(); }}>Retry playback</button></div>}
  </div>;
}
