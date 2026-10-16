import { BackLink, Button, ActionLink } from "../../components/Action.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import resilientGet from "../../services/resilientGet.js";
import DoubtChat from "../../components/DoubtChat.jsx";

function CourseConversation({ id, courses }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null), [error, setError] = useState(""), [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0), active = useRef(null), lastRead = useRef(0);
  const load = useCallback(async ({ background = false } = {}) => {
    if (background && active.current) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    const version = ++generation.current; lastRead.current = Date.now(); setRefreshing(true);
    try {
      const result = await (background ? axiosInstance.get(`/courses/${id}/doubt-dost`, { signal: controller.signal, timeout: 12000 }) : resilientGet(`/courses/${id}/doubt-dost`, { signal: controller.signal }));
      if (!controller.signal.aborted && version === generation.current) { setData(result.data.data); setError(""); }
    } catch (e) {
      if (!controller.signal.aborted && version === generation.current) {
        if ([401, 403, 404, 410].includes(e.response?.status)) setData(null);
        if (!background || [401, 403, 404, 410].includes(e.response?.status)) setError(errorMessage(e));
      }
    } finally { if (active.current === controller) { active.current = null; setRefreshing(false); } }
  }, [id]);
  useEffect(() => { void load(); return () => { active.current?.abort(); }; }, [load]);
  const hasPending = data?.turns.some(turn => turn.status === "pending");
  const unavailable = data?.available === false;
  useEffect(() => {
    if (!hasPending && !unavailable) return;
    let stopped = false, timer, attempts = 0;
    const schedule = () => { if (!stopped) timer = setTimeout(tick, hasPending ? 5000 : attempts < 4 ? 15000 : 60000); };
    const tick = async () => { if (!document.hidden && !active.current) { attempts++; await load({ background: true }); } schedule(); };
    schedule(); return () => { stopped = true; clearTimeout(timer); };
  }, [hasPending, unavailable, load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !active.current && Date.now() - lastRead.current > 5000) void load({ background: true }); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  const title = data?.course.title || courses.find(course => course._id === id)?.title || "Your course";
  const choices = courses.some(course => course._id === id) ? courses : [{ _id: id, title }, ...courses];
  return <div className="doubt-workspace">
    <aside className="doubt-course-rail"><ActionLink to="/doubts" className="doubt-rail-home"><Sparkles size={19} aria-hidden="true" />Your study chats</ActionLink><p>One conversation for each course.</p><nav aria-label="Course conversations">{choices.map(course => <Link key={course._id} to={`/courses/${course._id}/doubts`} aria-current={course._id === id ? "page" : undefined}><MessageCircle size={17} aria-hidden="true" /><span>{course.title}</span></Link>)}</nav><div className="doubt-rail-note"><ShieldCheck size={18} aria-hidden="true" /><p>Learn from the PDFs approved for your course. Your recent conversation is saved here.</p></div></aside>
    <div className="doubt-chat-panel"><header className="doubt-page-header"><div className="doubt-page-title"><span className="doubt-avatar"><Sparkles size={21} aria-hidden="true" /></span><div><h1>Doubt Dost</h1><p>{title}</p></div></div><BackLink to={`/courses/${id}`}>Back to course</BackLink></header>
      <div className="doubt-mobile-course"><label htmlFor="doubt-course-switch">Course</label><select id="doubt-course-switch" aria-label="Chat course" value={id} onChange={event => navigate(`/courses/${event.target.value}/doubts`)}>{choices.map(course => <option key={course._id} value={course._id}>{course.title}</option>)}</select><Link to="/doubts" aria-label="Choose another course"><BookOpen size={18} aria-hidden="true" /></Link></div>
      {error && <div className="doubt-load-error" role="alert"><p>{error}</p><Button className="btn-secondary" onClick={load}>Reload chat</Button><ActionLink className="btn-secondary" to={`/courses/${id}`}>Open course</ActionLink></div>}
      {!data && !error && <div className="doubt-chat-skeleton" role="status" aria-label="Loading Doubt Dost…"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><p>Opening your study chat…</p></div>}
      {data && <DoubtChat key={id} courseId={id} initialTurns={data.turns} available={data.available} readiness={data.readiness} refreshing={refreshing} dailyRemaining={data.dailyRemaining} documents={data.documents} onRefresh={load} />}
    </div>
  </div>;
}
export default function DoubtDostPage() {
  const { id } = useParams();
  const [courses, setCourses] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const loadCourses = useCallback(async signal => {
    setLoading(true);
    try { const result = await resilientGet("/courses", { params: { enrolled: true }, signal }); if (!signal?.aborted) { setCourses(result.data.data.courses.filter(course => course.access?.videos === true)); setError(""); } }
    catch (e) { if (!signal?.aborted) setError(errorMessage(e)); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void loadCourses(controller.signal); return () => controller.abort(); }, [loadCourses]);
  if (id) return <section className="doubt-page"><CourseConversation key={id} id={id} courses={courses} /></section>;
  return <section className="doubt-hub"><div className="doubt-hub-intro"><span className="doubt-welcome-mark"><Sparkles size={34} aria-hidden="true" /></span><p className="doubt-kicker">AAPKA STUDY COMPANION</p><h1>Doubt chhota ho ya bada.<br /><span>Poochh ke dekho.</span></h1><p>Meet Doubt Dost. Pick your course, ask in your own words, and understand the answer with sources from your course PDFs.</p><div className="doubt-hub-features"><span><MessageCircle size={16} aria-hidden="true" />Hindi · English · Hinglish</span><span><ShieldCheck size={16} aria-hidden="true" />Based on approved course PDFs</span></div></div>
    <div className="doubt-course-heading"><h2>Your course conversations</h2><span>Pick up where you left off</span></div>
    {loading && <div className="doubt-course-grid" role="status" aria-label="Loading your study chats…">{[0, 1].map(i => <div key={i} className="skeleton h-32" />)}</div>}
    {!loading && error && <div className="doubt-load-error" role="alert"><p>{error}</p><Button className="btn-secondary" onClick={() => loadCourses()}>Reload courses</Button></div>}
    {!loading && !error && (courses.length ? <div className="doubt-course-grid">{courses.map(course => <Link className="doubt-course-option" to={`/courses/${course._id}/doubts`} key={course._id}><span className="doubt-course-icon"><BookOpen size={22} aria-hidden="true" /></span><div><p>{course.category?.name || "Your course"}</p><h3>{course.title}</h3><span>Open course conversation</span></div><ArrowRight size={20} aria-hidden="true" /></Link>)}</div> : <div className="doubt-hub-empty"><BookOpen size={28} aria-hidden="true" /><h2>Your study chat starts with a course</h2><p>Enroll in a course or ask your instructor for access, then come back to ask your doubts.</p><ActionLink className="btn-primary" to="/courses">Explore courses</ActionLink></div>)}
    <p className="doubt-hub-footnote">Your instructor needs to publish the course PDFs before AI answers become available.</p>
  </section>;
}
