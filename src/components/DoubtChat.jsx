import { Button, ActionLink } from "./Action.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Check, Copy, Lightbulb, MessageCircle, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import axiosInstance, { errorMessage } from "../services/axiosInstance.js";
import "./DoubtDost.css";
const EMPTY_TURNS = [];
const PROMPTS = [
  { title: "Concept clear karo", text: "Explain a concept", draft: "Please explain [topic from my course] in simple words, with an example.", icon: Lightbulb },
  { title: "Difference samjhao", text: "Compare two ideas", draft: "What is the difference between [concept A] and [concept B] in my course material?", icon: BookOpen },
  { title: "Quick revision", text: "Make a topic easier to revise", draft: "Help me revise [topic from my course] with the key points from the PDFs.", icon: Sparkles },
];
// Model text cannot run HTML or load images. Only authenticated PDF citations
// below open source material; generated Markdown links remain plain text.
const markdownComponents = {
  a: ({ children }) => <span>{children}</span>, img: () => null,
  table: ({ children }) => <div className="doubt-table-scroll" tabIndex={0} role="region" aria-label="Answer table"><table>{children}</table></div>,
  h1: ({ children }) => <h3>{children}</h3>, h2: ({ children }) => <h3>{children}</h3>,
};
export default function DoubtChat({ courseId, initialTurns = EMPTY_TURNS, available = true, dailyRemaining, preview = false, documents, onRefresh }) {
  const [turns, setTurns] = useState(initialTurns), [question, setQuestion] = useState(""), [language, setLanguage] = useState("hinglish");
  const [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(""), [error, setError] = useState(""), [sourceError, setSourceError] = useState("");
  const [showLatest, setShowLatest] = useState(false), [copied, setCopied] = useState(null);
  const operation = useRef(null), active = useRef(null), input = useRef(null), conversation = useRef(null), follow = useRef(true), copyTimer = useRef(null);
  const pending = turns.some(turn => turn.status === "pending");
  const exhausted = Number.isFinite(dailyRemaining) && dailyRemaining <= 0;
  const preparing = busy || pending, disabled = !available || exhausted || preparing;
  const canSend = !disabled && question.trim().length > 0;
  useEffect(() => { if (!active.current) setTurns(initialTurns); }, [initialTurns]);
  useEffect(() => () => { active.current?.abort(); clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    const area = conversation.current;
    const observer = new ResizeObserver(() => { if (follow.current && area) { area.scrollTop = turns.length || busy ? area.scrollHeight : 0; setShowLatest(false); } });
    if (area) observer.observe(area);
    return () => observer.disconnect();
  }, [turns.length, busy]);
  useLayoutEffect(() => {
    const field = input.current;
    if (field) { field.style.height = "auto"; field.style.height = `${Math.min(field.scrollHeight, 144)}px`; }
  }, [question]);
  const latest = () => { const area = conversation.current; if (area) area.scrollTop = area.scrollHeight; follow.current = true; setShowLatest(false); };
  useLayoutEffect(() => { if (!turns.length && !busy) { if (conversation.current) conversation.current.scrollTop = 0; follow.current = true; setShowLatest(false); } else if (follow.current) latest(); else setShowLatest(true); }, [turns, busy]);
  const compose = text => { setQuestion(text); input.current?.focus(); };
  const send = async () => {
    const value = question.trim(); if (!value || value.length > 2000 || active.current || disabled) return;
    const signature = JSON.stringify([value, language]);
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    const controller = new AbortController(); active.current = controller; follow.current = true; setBusy(true); setSubmitted(value); setError("");
    try {
      const result = await axiosInstance.post(preview ? `/admin/doubt-dost/courses/${courseId}/preview` : `/courses/${courseId}/doubt-dost`, { question: value, language, requestId: operation.current.id }, { signal: controller.signal, timeout: 70000 });
      if (controller.signal.aborted) return;
      const turn = result.data.data.turn;
      setTurns(items => [...items.filter(item => item.id !== turn.id), turn].slice(-30));
      operation.current = null; setQuestion(""); if (onRefresh) void onRefresh();
    } catch (e) { if (!controller.signal.aborted) { setError(errorMessage(e)); if (e.response) operation.current = null; } }
    finally { if (active.current === controller) { active.current = null; setBusy(false); setSubmitted(""); } }
  };
  const rate = async (turn, feedback) => {
    setSourceError("");
    try { await axiosInstance.put(`/courses/${courseId}/doubt-dost/${turn.id}/feedback`, { feedback }); setTurns(items => items.map(item => item.id === turn.id ? { ...item, feedback } : item)); }
    catch (e) { setSourceError(errorMessage(e)); }
  };
  const copy = async turn => {
    setSourceError("");
    try { await navigator.clipboard.writeText(turn.answer); setCopied(turn.id); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(null), 2000); }
    catch { setSourceError("Could not copy automatically. You can select and copy the answer text."); }
  };
  const openSource = async source => {
    setSourceError(""); const tab = window.open("about:blank", "_blank");
    if (!tab) { setSourceError("Allow a new tab to open the source PDF."); return; } tab.opener = null;
    try {
      const response = await axiosInstance.get(`/courses/${courseId}/doubt-dost/documents/${source.documentId}/url`);
      const url = new URL(response.data.data.url); if (url.protocol !== "https:") throw new Error("The source link is unavailable.");
      if (source.page) url.hash = `page=${source.page}`; tab.location.replace(url.href);
    } catch (e) { tab.close(); setSourceError(errorMessage(e)); }
  };
  return <div className={`doubt-chat ${preview ? "doubt-chat--preview" : "doubt-chat--student"}`}>
    {preview && <header className="doubt-chat-heading"><span className="doubt-avatar"><Sparkles size={22} aria-hidden="true" /></span><div><h2>Doubt Dost <span>Admin preview</span></h2><p>Try your indexed course material before publishing.</p></div></header>}
    <div className="doubt-thread-area">
      <div ref={conversation} className="doubt-conversation" role="region" aria-label="Your Doubt Dost conversation" tabIndex={0} onScroll={event => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; setShowLatest(turns.length > 0 && !follow.current); }}>
        <div className="doubt-thread">
          {!turns.length && !busy && <div className="doubt-welcome"><span className="doubt-welcome-mark"><Sparkles size={32} aria-hidden="true" /></span><p className="doubt-kicker">YOUR COURSE. YOUR PACE.</p><h2>Kahan atak gaye?</h2><p>Chalo, milkar samajhte hain. Ask a question from your course PDFs in Hindi, English or Hinglish.</p><div className="doubt-prompts">{PROMPTS.map(({ title, text, draft, icon: Icon }) => <Button className="doubt-prompt" type="button" key={title} disabled={disabled} onClick={() => compose(draft)}><Icon size={20} aria-hidden="true" /><strong>{title}</strong><span>{text}</span><ArrowUpRight size={16} className="doubt-prompt-arrow" aria-hidden="true" /></Button>)}</div><span className="doubt-grounding"><ShieldCheck size={14} aria-hidden="true" />Answers grounded in {preview ? "indexed" : "approved"} course PDFs{Number.isFinite(documents) && ` · ${documents} ${documents === 1 ? "PDF" : "PDFs"}`}</span></div>}
          {turns.map(turn => <article className="doubt-turn" key={turn.id}>
            <div className="doubt-question"><span className="sr-only">You asked</span><p>{turn.question}</p></div>
            <div className="doubt-answer"><p className="doubt-answer-label"><span className="doubt-answer-avatar"><Sparkles size={17} aria-hidden="true" /></span>Doubt Dost <span className="doubt-ai-label">STUDY ASSISTANT</span></p>{turn.status === "pending" ? <p role="status" className="doubt-thinking"><span className="doubt-thinking-dot" />Finding an explanation in your course PDFs…</p> : <div className="doubt-answer-text"><Markdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>{turn.answer || "This answer was interrupted. You can ask the doubt again."}</Markdown></div>}
              {turn.sources?.length > 0 && <div className="doubt-sources"><p><BookOpen size={14} aria-hidden="true" />From your course material</p>{turn.sources.map((source, index) => <details key={`${source.documentId}:${source.page || index}`}><summary><BookOpen size={15} aria-hidden="true" /><span>{source.filename}{source.page ? ` · Page ${source.page}` : ""}</span></summary><div className="doubt-source-content"><p>{source.excerpt}</p><Button type="button" className="doubt-source-open" onClick={() => openSource(source)}>Open source PDF<ArrowUpRight size={15} aria-hidden="true" /></Button></div></details>)}</div>}
              {turn.status !== "pending" && <div className="doubt-answer-actions">{turn.answer && <Button type="button" className="doubt-feedback doubt-icon-button" aria-label={copied === turn.id ? "Answer copied" : "Copy answer"} title={copied === turn.id ? "Copied" : "Copy answer"} onClick={() => copy(turn)}>{copied === turn.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</Button>}{!preview && <>{turn.status !== "failed" && <><Button type="button" className="doubt-feedback doubt-icon-button" aria-label="Helpful answer" title="Helpful" aria-pressed={turn.feedback === "helpful"} onClick={() => rate(turn, "helpful")}><ThumbsUp size={16} aria-hidden="true" /></Button><Button type="button" className="doubt-feedback doubt-icon-button" aria-label="Unhelpful answer" title="Needs help" aria-pressed={turn.feedback === "unhelpful"} onClick={() => rate(turn, "unhelpful")}><ThumbsDown size={16} aria-hidden="true" /></Button></>}<Link className="doubt-feedback" to={`/courses/${courseId}/support`} state={{ doubtQuestion: turn.question }}><MessageCircle size={15} aria-hidden="true" />Ask instructor</Link></>}{["failed", "unanswered"].includes(turn.status) && <Button className="doubt-feedback" type="button" disabled={disabled} onClick={() => { operation.current = null; compose(turn.question); }}>Ask again</Button>}{turn.status === "answered" && <Button className="doubt-feedback" type="button" disabled={disabled} onClick={() => compose(`Please explain your answer to “${turn.question.slice(0, 400)}” in simpler words, with an example from the course material.`)}><Lightbulb size={15} aria-hidden="true" />Aasaan bhasha mein</Button>}</div>}
            </div>
          </article>)}
          {busy && <article className="doubt-turn doubt-turn--pending"><div className="doubt-question"><span className="sr-only">You asked</span><p>{submitted}</p></div><div className="doubt-answer"><p className="doubt-answer-label"><span className="doubt-answer-avatar"><Sparkles size={17} aria-hidden="true" /></span>Doubt Dost</p><p className="doubt-thinking" role="status"><span className="doubt-thinking-dot" />Reading the relevant course passages…</p></div></article>}
        </div>
      </div>
      {showLatest && <Button type="button" className="doubt-jump" aria-label="Jump to latest message" onClick={latest}><ArrowDown size={18} aria-hidden="true" /><span>Latest message</span></Button>}
    </div>
    <div className="doubt-composer"><div className="doubt-composer-inner">
      {!available && <div className="doubt-notice" role="status"><p>{preview ? "Upload a PDF and wait for indexing before trying a preview." : "Your course’s doubt assistant is being prepared. You can ask your instructor in the meantime."}</p>{!preview && <ActionLink className="doubt-feedback" to={`/courses/${courseId}/support`}><MessageCircle size={16} aria-hidden="true" />Ask instructor</ActionLink>}</div>}
      {available && exhausted && <div className="doubt-notice" role="status"><p>You’ve used today’s answer allowance. You can read your chat or ask your instructor. Your allowance resets at midnight in India.</p>{!preview && <ActionLink className="doubt-feedback" to={`/courses/${courseId}/support`}><MessageCircle size={16} aria-hidden="true" />Ask instructor</ActionLink>}</div>}
      {error && <p role="alert" className="doubt-error">{error} Your question is kept below.</p>}{sourceError && <p role="alert" className="doubt-error">{sourceError}</p>}
      <form className="doubt-message-form" onSubmit={event => { event.preventDefault(); void send(); }}><fieldset disabled={disabled}>
        <label className="sr-only" htmlFor={preview ? "doubt-preview-input" : "doubt-message-input"}>Your doubt</label><textarea id={preview ? "doubt-preview-input" : "doubt-message-input"} ref={input} aria-label="Your doubt" aria-describedby={preview ? "doubt-preview-help" : "doubt-message-help"} rows={1} maxLength={2000} required value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (canSend) void send(); } }} placeholder="Apna doubt yahan poochho…" />
        <div className="doubt-composer-actions"><label className="doubt-language"><span className="sr-only">Answer language</span><select aria-label="Answer language" value={language} onChange={event => setLanguage(event.target.value)}><option value="hinglish">Hinglish</option><option value="hi">हिन्दी</option><option value="en">English</option></select></label><span className="doubt-character-count">{question.length}/2000</span><Button type="submit" className="doubt-send" aria-label="Ask Doubt Dost" title="Send message" disabled={!canSend}><ArrowUp size={21} aria-hidden="true" /></Button></div>
      </fieldset></form>
      <div className="doubt-composer-help" id={preview ? "doubt-preview-help" : "doubt-message-help"}><span>{preparing ? "Preparing your answer…" : "Enter to send · Shift + Enter for a new line"}</span>{Number.isFinite(dailyRemaining) && <span>{dailyRemaining} answers left today</span>}</div>
      <details className="doubt-privacy"><summary>AI can make mistakes. Check the sources.<span>About this chat</span></summary><p>{preview ? "Preview includes indexed drafts and uses the answer allowance." : "Chats are private to you and platform admins, kept for up to 90 days. Ask instructor opens a draft for you to review and send."}</p></details>
    </div></div>
  </div>;
}
