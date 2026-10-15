import { Button, ActionLink } from "./Action.jsx";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, MessageCircle, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import "./DoubtDost.css";
const EMPTY_TURNS = [];

export default function DoubtChat({ courseId, initialTurns = EMPTY_TURNS, available = true, dailyRemaining, preview = false, onRefresh }) {
  const [turns, setTurns] = useState(initialTurns), [question, setQuestion] = useState(""), [language, setLanguage] = useState("hinglish");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sourceError, setSourceError] = useState("");
  const operation = useRef(null), active = useRef(null), input = useRef(null), bottom = useRef(null);
  useEffect(() => { setTurns(initialTurns); }, [initialTurns]);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (turns.length || busy) bottom.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [turns.length, busy]);
  const pending = turns.some(turn => turn.status === "pending");
  const send = async (text = question) => {
    const value = text.trim(); if (!value || value.length > 2000 || active.current || !available || pending) return;
    const signature = JSON.stringify([value, language]);
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    const controller = new AbortController(); active.current = controller; setBusy(true); setError("");
    try {
      const result = await axiosInstance.post(preview ? `/admin/doubt-dost/courses/${courseId}/preview` : `/courses/${courseId}/doubt-dost`, { question: value, language, requestId: operation.current.id }, { signal: controller.signal, timeout: 70000 });
      if (controller.signal.aborted) return;
      const turn = result.data.data.turn;
      setTurns(items => [...items.filter(item => item.id !== turn.id), turn].slice(-30));
      operation.current = null; setQuestion("");
      if (onRefresh) void onRefresh();
    } catch (e) {
      if (!controller.signal.aborted) { setError(errorMessage(e)); if (e.response) operation.current = null; }
    } finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  const rate = async (turn, feedback) => {
    setSourceError("");
    try { await axiosInstance.put(`/courses/${courseId}/doubt-dost/${turn.id}/feedback`, { feedback }); setTurns(items => items.map(item => item.id === turn.id ? { ...item, feedback } : item)); }
    catch (e) { setSourceError(errorMessage(e)); }
  };
  const openSource = async (source) => {
    setSourceError("");
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setSourceError("Allow a new tab to open the source PDF."); return; }
    tab.opener = null;
    try {
      const response = await axiosInstance.get(`/courses/${courseId}/doubt-dost/documents/${source.documentId}/url`);
      const url = new URL(response.data.data.url);
      if (url.protocol !== "https:") throw new Error("The source link is unavailable.");
      if (source.page) url.hash = `page=${source.page}`;
      tab.location.replace(url.href);
    } catch (e) { tab.close(); setSourceError(errorMessage(e)); }
  };
  return <div className="doubt-chat card !p-0">
    <div className="doubt-chat-heading"><span className="doubt-avatar"><Sparkles size={22} aria-hidden="true" /></span><div><h2 className="text-xl font-semibold">Doubt Dost{preview && <span className="ml-2 text-xs text-muted">Admin preview</span>}</h2><p className="mt-1 text-sm text-muted">Sawaal poochho. Samajh ke aage badho.</p></div></div>
    <div className="doubt-conversation" aria-label="Your Doubt Dost conversation">
      {!turns.length && <div className="doubt-welcome"><BookOpen size={28} aria-hidden="true" /><h3 className="mt-4 text-xl font-semibold">Kahan atak gaye?</h3><p className="mt-3 leading-7 text-muted">Ask about a concept from this course. I’ll explain it using the {preview ? "indexed" : "published"} course PDFs and show you the sources.</p><div className="doubt-prompts">{["Ek concept simple words mein samjhao", "Is topic ka ek example do"].map(text => <Button className="btn-secondary text-left" type="button" key={text} disabled={!available || busy} onClick={() => { setQuestion(text); input.current?.focus(); }}>{text}<ArrowUpRight size={15} aria-hidden="true" /></Button>)}</div></div>}
      {turns.map(turn => <article className="doubt-turn" key={turn.id}>
        <div className="doubt-question"><span className="text-xs font-semibold">You asked</span><p className="mt-2 whitespace-pre-wrap break-words">{turn.question}</p></div>
        <div className="doubt-answer"><p className="doubt-answer-label"><Sparkles size={16} aria-hidden="true" />Doubt Dost · AI study assistant</p>{turn.status === "pending" ? <p role="status" className="mt-3 text-muted">Finding an explanation in your course PDFs…</p> : <p className="mt-3 whitespace-pre-wrap break-words leading-8">{turn.answer || "This answer was interrupted. You can ask the doubt again."}</p>}
          {turn.sources?.length > 0 && <div className="doubt-sources"><p className="text-xs font-semibold uppercase tracking-wide text-muted">From your course material</p>{turn.sources.map((source, index) => <details key={`${source.documentId}:${source.page || index}`}><summary><BookOpen size={15} aria-hidden="true" /><span>{source.filename}{source.page ? ` · Page ${source.page}` : ""}</span></summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{source.excerpt}</p><Button type="button" className="btn-secondary mt-3 gap-2" onClick={() => openSource(source)}>Open source PDF<ArrowUpRight size={15} aria-hidden="true" /></Button></details>)}</div>}
          {turn.status !== "pending" && <div className="doubt-answer-actions">{!preview && <>{turn.status !== "failed" && <><Button type="button" className="doubt-feedback" aria-label="Helpful answer" aria-pressed={turn.feedback === "helpful"} onClick={() => rate(turn, "helpful")}><ThumbsUp size={16} aria-hidden="true" />Helpful</Button><Button type="button" className="doubt-feedback" aria-label="Unhelpful answer" aria-pressed={turn.feedback === "unhelpful"} onClick={() => rate(turn, "unhelpful")}><ThumbsDown size={16} aria-hidden="true" />Needs help</Button></>}<Link className="doubt-feedback" to={`/courses/${courseId}/support`} state={{ doubtQuestion: turn.question }}><MessageCircle size={16} aria-hidden="true" />Ask instructor</Link></>}{["failed", "unanswered"].includes(turn.status) && <Button className="doubt-feedback" type="button" onClick={() => { operation.current = null; setQuestion(turn.question); input.current?.focus(); }}>Ask again</Button>}{turn.status === "answered" && <Button className="doubt-feedback" type="button" disabled={busy || pending || !available} onClick={() => { setQuestion(`Please explain your answer to “${turn.question.slice(0, 400)}” in simpler words, with an example from the course material.`); input.current?.focus(); }}>Aasaan bhasha mein</Button>}</div>}
        </div>
      </article>)}
      {busy && <div className="doubt-thinking" role="status"><span className="skeleton h-3 w-3 !rounded-full" />Reading the relevant course passages…</div>}
      <div ref={bottom} />
    </div>
    <div className="doubt-composer">
      {!available && <div className="mb-4 rounded-xl bg-primary-50 p-4 text-sm leading-7 text-primary-900 dark:bg-primary-950 dark:text-primary-100" role="status"><p>{preview ? "Upload a PDF and wait for indexing before trying a preview." : "Your course’s doubt assistant is being prepared. You can ask your instructor in the meantime."}</p>{!preview && <ActionLink className="btn-secondary mt-3 gap-2" to={`/courses/${courseId}/support`}><MessageCircle size={16} aria-hidden="true" />Ask instructor</ActionLink>}</div>}
      {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error} Your question is kept below.</p>}
      {sourceError && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{sourceError}</p>}
      <form onSubmit={event => { event.preventDefault(); void send(); }}><fieldset disabled={!available || busy || pending} className="min-w-0"><label className="block text-sm font-semibold">Your doubt<textarea ref={input} aria-label="Your doubt" className="input-field mt-2" rows={3} maxLength={2000} required value={question} onChange={event => setQuestion(event.target.value)} placeholder="For example: RAM aur ROM mein kya difference hai?" /></label><div className="doubt-composer-actions"><label className="text-sm font-medium">Answer language<select aria-label="Answer language" className="input-field mt-2" value={language} onChange={event => setLanguage(event.target.value)}><option value="hinglish">Hinglish</option><option value="hi">हिन्दी</option><option value="en">English</option></select></label><span className="text-xs text-muted">{question.length}/2000{Number.isFinite(dailyRemaining) ? ` · ${dailyRemaining} answers left today` : ""}</span><Button type="submit" className="btn-primary gap-2"><Send size={16} aria-hidden="true" />{busy || pending ? "Preparing answer…" : "Ask Doubt Dost"}</Button></div></fieldset></form>
      <p className="mt-4 text-xs leading-6 text-muted">AI explanations can contain mistakes. Check the cited material. {preview ? "Preview includes indexed drafts and uses the answer allowance." : "Chats are private to you and platform admins, kept for up to 90 days. Ask instructor opens a draft for you to review and send."}</p>
    </div>
  </div>;
}
