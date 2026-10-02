import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { X, AlertTriangle, Pencil } from "lucide-react";
import { errorMessage } from "../services/axiosInstance.js";
import { useLocation } from "react-router-dom";
import { trapDialogFocus } from "./dialogFocus.js";
const DecisionContext = createContext(null);
export const useDecision = () => useContext(DecisionContext);
function DecisionDialog({ options, finish }) {
  const ref = useRef(null), submitting = useRef(false), titleId = useId(), bodyId = useId();
  const [value, setValue] = useState(options.initialValue || ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { const dialog = ref.current; dialog.showModal(); const focus = dialog.querySelector(options.inputLabel ? "input" : "[data-cancel]"); focus?.focus(); if (options.inputLabel) focus?.select(); return () => dialog.close(); }, [options.inputLabel]);
  useEffect(() => { if (busy) ref.current.focus(); }, [busy]);
  const submit = async (event) => {
    event.preventDefault(); if (submitting.current || (options.inputLabel && !value.trim())) return;
    submitting.current = true; setBusy(true); setError("");
    try { await options.onConfirm?.(value.trim()); finish(options.inputLabel ? value.trim() : true); }
    catch (e) { setError(errorMessage(e)); submitting.current = false; setBusy(false); }
  };
  return <dialog ref={ref} tabIndex={-1} onKeyDown={trapDialogFocus} className="admin-dialog decision-dialog" aria-labelledby={titleId} aria-describedby={bodyId} onCancel={(e) => { e.preventDefault(); if (!submitting.current) finish(null); }}>
    <form onSubmit={submit}>
      <div className="flex items-start justify-between gap-4"><span className={`dialog-icon ${options.destructive ? "dialog-icon-danger" : ""}`} aria-hidden="true">{options.inputLabel ? <Pencil size={20} /> : <AlertTriangle size={20} />}</span><button type="button" className="btn-secondary h-9 w-9 !p-0" aria-label="Close dialog" disabled={busy} onClick={() => finish(null)}><X size={17} /></button></div>
      <h2 id={titleId} className="mt-5 text-xl font-semibold">{options.title}</h2><p id={bodyId} className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{options.body}</p>
      {options.inputLabel && <label className="mt-5 block text-sm font-medium">{options.inputLabel}<input autoFocus required maxLength={options.maxLength || 160} value={value} disabled={busy} onChange={(e) => setValue(e.target.value)} className="input-field mt-2" /></label>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {busy && <p role="status" className="mt-4 text-sm text-slate-500 dark:text-slate-400">Saving your change…</p>}
      <div className="mt-7 flex flex-wrap justify-end gap-3"><button data-cancel type="button" className="btn-secondary" disabled={busy} onClick={() => finish(null)}>Cancel</button><button type="submit" className={options.destructive ? "btn-danger" : "btn-primary"} disabled={busy || Boolean(options.inputLabel && !value.trim())}>{busy ? "Saving…" : options.confirmLabel || "Confirm"}</button></div>
    </form>
  </dialog>;
}
export default function DecisionProvider({ children }) {
  const location = useLocation();
  const pending = useRef(null), [options, setOptions] = useState(null);
  const ask = (next) => new Promise((resolve) => { if (pending.current) { resolve(null); return; } pending.current = { resolve, trigger: document.activeElement }; setOptions(next); });
  const finish = (value) => { const request = pending.current; if (!request) return; pending.current = null; setOptions(null); request.resolve(value); requestAnimationFrame(() => { const menu = request.trigger?.closest("details:not([open])"); const target = request.trigger?.isConnected ? menu?.querySelector("summary") || request.trigger : document.querySelector("#workspace-content"); target?.focus({ preventScroll: true }); }); };
  useEffect(() => () => { pending.current?.resolve(null); pending.current = null; }, []);
  useEffect(() => { const request = pending.current; request?.resolve(null); pending.current = null; setOptions(null); if (request) requestAnimationFrame(() => document.querySelector("#workspace-content")?.focus({ preventScroll: true })); }, [location.key]);
  return <DecisionContext.Provider value={ask}>{children}{options && <DecisionDialog options={options} finish={finish} />}</DecisionContext.Provider>;
}
