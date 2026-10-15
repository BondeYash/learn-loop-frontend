import { BackLink, Button, ActionLink } from "../../components/Action.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance, { errorMessage } from "../../services/axiosInstance.js";
import DoubtChat from "../../components/DoubtChat.jsx";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import WorkspaceIntro from "../../components/WorkspaceIntro.jsx";
export default function DoubtDostPage() {
  const { id } = useParams(), [data, setData] = useState(null), [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async (signal) => {
    const version = ++generation.current;
    try { const result = await axiosInstance.get(`/courses/${id}/doubt-dost`, { signal }); if (!signal?.aborted && version === generation.current) { setData(result.data.data); setError(""); } }
    catch (e) { if (!signal?.aborted && version === generation.current) { setData(null); setError(errorMessage(e)); } }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const hasPending = data?.turns.some(turn => turn.status === "pending");
  useEffect(() => { if (!hasPending) return; const controller = new AbortController(), timer = setInterval(() => { if (!document.hidden) void load(controller.signal); }, 5000); return () => { clearInterval(timer); controller.abort(); }; }, [hasPending, load]);
  return <section><BackLink  to={`/courses/${id}`}>Back to course</BackLink><div className="my-6"><WorkspaceIntro eyebrow="Apne doubts ko dein ek naya raasta" title="Doubt Dost">{data?.course.title || "Your course study assistant"}</WorkspaceIntro></div>{error && <div className="card" role="alert"><p>{error}</p><Button className="btn-secondary mt-4" onClick={() => load()}>Reload chat</Button><ActionLink className="btn-secondary mt-4 ml-3" to={`/courses/${id}`}>Open course</ActionLink></div>}{!data && !error && <LoadingSkeleton variant="detail" label="Loading Doubt Dost…" />}{data && <DoubtChat key={id} courseId={id} initialTurns={data.turns} available={data.available} dailyRemaining={data.dailyRemaining} onRefresh={() => load()} />}</section>;
}
