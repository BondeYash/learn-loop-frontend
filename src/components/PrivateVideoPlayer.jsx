import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Keyboard, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import { PLAYBACK_SPEEDS, SKIP_SECONDS, readVideoPreferences, saveVideoPreferences } from "../services/videoPreferences.js";
import "./PrivateVideoPlayer.css";
export default function PrivateVideoPlayer({ lessonId, title, studentId, ticketPath, ticketField, initialPosition = 0, onPosition }) {
  const player = useRef(null);
  const container = useRef(null);
  const shortcutsId = useId();
  const [preferences, setPreferences] = useState(readVideoPreferences);
  const preferencesRef = useRef(preferences);
  const [paused, setPaused] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [feedback, setFeedback] = useState("");
  const feedbackTimer = useRef(null);
  // A shortened account code avoids displaying a learner's name or email.
  // This removable UI overlay and nodownload are deterrents, not DRM.
  const watermark = studentId ? `Learner ${String(studentId).slice(-8).toUpperCase()}` : null;
  const [fullscreenAvailable, setFullscreenAvailable] = useState(() => typeof document !== "undefined" && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const resume = useRef({ time: initialPosition, playing: false, volume: 1, muted: false });
  const reportedAt = useRef(0);
  const pending = useRef(null);
  const automaticRetries = useRef(0);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [buffering, setBuffering] = useState(true);
  const rememberPlayback = () => {
    const video = player.current;
    if (video?.readyState >= 1) resume.current = { time: video.currentTime || 0, playing: !video.paused, volume: video.volume, muted: video.muted, focused: document.activeElement === video };
  };
  const renew = useCallback(async (preserve = true) => {
    if (pending.current) return;
    if (preserve) rememberPlayback();
    const controller = new AbortController(); pending.current = controller;
    setBuffering(true); setError("");
    try {
      const response = await axiosInstance.get(ticketPath || `/lessons/${lessonId}/playback`, { signal: controller.signal });
      if (!controller.signal.aborted) {
        // The learner may keep watching or seek while a replacement link loads.
        if (preserve) rememberPlayback();
        const nextTicket = ticketField ? response.data.data[ticketField] : response.data.data;
        if (player.current?.currentSrc !== nextTicket.url) setMediaReady(false);
        else setBuffering(player.current.readyState < 3);
        setTicket(nextTicket);
      }
    } catch (e) {
      if (!controller.signal.aborted) { player.current?.pause(); setTicket(null); setBuffering(false); setError(errorMessage(e)); }
    } finally { if (pending.current === controller) pending.current = null; }
  }, [lessonId, ticketPath, ticketField]);
  useEffect(() => {
    renew(false);
    return () => { pending.current?.abort(); pending.current = null; clearTimeout(feedbackTimer.current); };
  }, [renew]);
  useEffect(() => {
    if (!ticket) return;
    const timer = setTimeout(() => renew(), Math.max(1000, ticket.expiresAt - Date.now() - 30000));
    return () => clearTimeout(timer);
  }, [ticket, renew]);
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(container.current && document.fullscreenElement === container.current));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement === container.current) await document.exitFullscreen();
      else await container.current.requestFullscreen();
    } catch {
      // If container fullscreen is unavailable, retain the native player option.
      setFullscreenAvailable(false);
      setFullscreenError("Fullscreen is unavailable here. You can keep watching or use your browser’s player controls.");
    }
  };
  const failed = () => {
    setBuffering(false);
    if (automaticRetries.current++ < 1) renew();
    else setError("Playback failed. Check your connection and retry. The file must use codecs supported by your browser; H.264/AAC MP4 is recommended.");
  };
  const announce = (message) => {
    clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = setTimeout(() => setFeedback(""), 1600);
  };
  const updatePreferences = (changes) => {
    const next = { ...preferencesRef.current, ...changes };
    preferencesRef.current = next;
    setPreferences(next);
    saveVideoPreferences(next);
  };
  const changeSpeed = (speed) => {
    if (!PLAYBACK_SPEEDS.includes(speed)) return;
    updatePreferences({ speed });
    if (player.current) { player.current.defaultPlaybackRate = speed; player.current.playbackRate = speed; }
    announce(`Playback speed ${speed}×`);
  };
  const seek = (seconds) => {
    const video = player.current;
    if (!mediaReady || error || !Number.isFinite(video?.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    announce(`${seconds < 0 ? "Back" : "Forward"} ${Math.abs(seconds)} seconds`);
  };
  const togglePlayback = () => {
    const video = player.current;
    if (!video || !mediaReady || error) return;
    if (!video.paused) video.pause();
    else video.play().catch(() => announce("Press play in the video to continue."));
  };
  const keyboardControl = (event) => {
    // Scope shortcuts to the player itself. Inputs, selects and focused buttons
    // keep their normal keys, and typing elsewhere never changes playback.
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || ![container.current, player.current].includes(event.target)) return;
    const key = event.key.toLowerCase();
    // Native controls live in a closed browser shadow tree. Their Space/arrow
    // events look like video events too; preserve slider/button keyboard use.
    if (event.target === player.current && [" ", "arrowleft", "arrowright"].includes(key)) return;
    if (![" ", "k", "j", "l", "arrowleft", "arrowright", "m", "f", "<", ">"].includes(key)) return;
    event.preventDefault();
    if ([" ", "k", "m", "f"].includes(key) && event.repeat) return;
    if (key === " " || key === "k") togglePlayback();
    else if (key === "j" || key === "arrowleft") seek(key === "j" ? -preferences.skip : -5);
    else if (key === "l" || key === "arrowright") seek(key === "l" ? preferences.skip : 5);
    else if (key === "m" && player.current) { player.current.muted = !player.current.muted; announce(player.current.muted ? "Sound muted" : "Sound on"); }
    else if (key === "f" && fullscreenAvailable) void toggleFullscreen();
    else if (key === ">") changeSpeed(PLAYBACK_SPEEDS.find(speed => speed > preferences.speed) || PLAYBACK_SPEEDS.at(-1));
    else if (key === "<") changeSpeed([...PLAYBACK_SPEEDS].reverse().find(speed => speed < preferences.speed) || PLAYBACK_SPEEDS[0]);
  };
  return <div>
    {ticket && <div ref={container} className="private-player overflow-hidden rounded-2xl bg-black" role="group" aria-label={`${title} video player`} aria-describedby={shortcutsId} tabIndex={0} onKeyDownCapture={keyboardControl}><div className="private-player-media relative"><video key={ticket.url} ref={player} controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black" aria-label={title} src={ticket.url}
      controlsList={watermark ? `nodownload${fullscreenAvailable ? " nofullscreen" : ""}` : undefined}
      onContextMenu={watermark ? (event) => event.preventDefault() : undefined}
      onLoadStart={() => { setBuffering(true); setMediaReady(false); }} onCanPlay={() => { setBuffering(false); setMediaReady(true); }} onPlaying={() => { setBuffering(false); setPaused(false); }} onPlay={() => setPaused(false)} onWaiting={() => setBuffering(true)} onError={failed} onEnded={() => setPaused(true)}
      onRateChange={(event) => { const speed = event.currentTarget.playbackRate; if (PLAYBACK_SPEEDS.includes(speed) && speed !== preferencesRef.current.speed) updatePreferences({ speed }); }}
      onTimeUpdate={(event) => { if (onPosition && performance.now() - reportedAt.current > 10000) { reportedAt.current = performance.now(); onPosition(event.currentTarget.currentTime); } }} onPause={(event) => { setPaused(true); if (event.currentTarget.readyState >= 1) onPosition?.(event.currentTarget.currentTime); }} onSeeked={(event) => onPosition?.(event.currentTarget.currentTime)}
      onSeeking={() => { if (Date.now() > ticket.expiresAt - 15000) renew(); }}
      onLoadedMetadata={(event) => { const video = event.currentTarget; video.currentTime = Math.max(0, Math.min(resume.current.time, Math.max(0, video.duration - 0.1))); video.defaultPlaybackRate = preferencesRef.current.speed; video.playbackRate = preferencesRef.current.speed; video.volume = resume.current.volume; video.muted = resume.current.muted; setMediaReady(true); setPaused(video.paused); if (resume.current.focused) video.focus({ preventScroll: true }); if (resume.current.playing) video.play().catch(() => {}); }}>
      Your browser does not support HTML5 video.
    </video>{watermark && <span className="private-player-watermark" aria-hidden="true">{watermark}</span>}
    {buffering && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30"><span className="rounded-full bg-black/70 px-4 py-2 text-sm text-white" role="status">Loading video…</span></div>}
    <div className="player-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback && <span>{feedback}</span>}</div></div>
      <div className="player-controls" aria-label="Video playback controls">
        <div className="player-transport">
          <button type="button" disabled={!mediaReady || Boolean(error)} className="player-control" onClick={() => seek(-preferences.skip)} aria-label={`Back ${preferences.skip} seconds`} title={`Back ${preferences.skip} seconds (J)`}><RotateCcw size={19} aria-hidden="true" /><span>{preferences.skip}s</span></button>
          <button type="button" disabled={!mediaReady || Boolean(error)} className="player-control player-play" onClick={togglePlayback} aria-label={paused ? "Play video" : "Pause video"} title="Play / pause (K)">{paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}</button>
          <button type="button" disabled={!mediaReady || Boolean(error)} className="player-control" onClick={() => seek(preferences.skip)} aria-label={`Forward ${preferences.skip} seconds`} title={`Forward ${preferences.skip} seconds (L)`}><RotateCw size={19} aria-hidden="true" /><span>{preferences.skip}s</span></button>
        </div>
        <div className="player-settings">
          <label className="player-setting">Speed<select aria-label="Playback speed" value={preferences.speed} onChange={event => changeSpeed(Number(event.target.value))}>{PLAYBACK_SPEEDS.map(speed => <option key={speed} value={speed}>{speed === 1 ? "1× Normal" : `${speed}×`}</option>)}</select></label>
          <label className="player-setting">Skip by<select aria-label="Skip interval" value={preferences.skip} onChange={event => updatePreferences({ skip: Number(event.target.value) })}>{SKIP_SECONDS.map(seconds => <option key={seconds} value={seconds}>{seconds} sec</option>)}</select></label>
        </div>
        {fullscreenAvailable && <button type="button" className="player-control player-fullscreen" aria-label={fullscreen ? "Exit video fullscreen" : "Enter video fullscreen"} aria-pressed={fullscreen} onClick={toggleFullscreen} title="Full screen (F)">{fullscreen ? <Minimize size={19} aria-hidden="true" /> : <Maximize size={19} aria-hidden="true" />}<span>{fullscreen ? "Exit full screen" : "Full screen"}</span></button>}
      </div>
      <details className="player-shortcuts"><summary><Keyboard size={15} aria-hidden="true" />Keyboard shortcuts</summary><p id={shortcutsId}>Focus the player first. <kbd>Space</kbd> / <kbd>K</kbd> play or pause · <kbd>J</kbd> / <kbd>L</kbd> skip by your chosen interval · <kbd>←</kbd> / <kbd>→</kbd> jump 5 seconds · <kbd>&lt;</kbd> / <kbd>&gt;</kbd> change speed · <kbd>M</kbd> mute{fullscreenAvailable && <> · <kbd>F</kbd> full screen</>}. The browser’s own controls keep their usual keys.</p></details>
    </div>}
    {fullscreenError && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300" role="status">{fullscreenError}</p>}
    {!ticket && !error && <p className="card" role="status">{ticketPath ? "Loading sample video…" : "Loading private video…"}</p>}
    {error && <div className="card mt-3" role="alert"><p className="text-sm text-red-700 dark:text-red-300">{error}</p><button className="btn-secondary mt-3" onClick={() => { automaticRetries.current = 0; renew(); }}>Retry playback</button></div>}
  </div>;
}
