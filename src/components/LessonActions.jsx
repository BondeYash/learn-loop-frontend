import { useEffect, useId, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
export default function LessonActions({ title, children }) {
  const ref = useRef(null), id = useId();
  useEffect(() => {
    const outside = (event) => { if (!ref.current?.contains(event.target)) ref.current?.removeAttribute("open"); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details ref={ref} className="lesson-actions relative shrink-0" onKeyDown={(event) => { if (event.key === "Escape" && ref.current.open) { event.preventDefault(); ref.current.removeAttribute("open"); ref.current.querySelector("summary").focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open"); }}><summary aria-label={`Actions for ${title}`} aria-controls={id} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#264140]"><MoreHorizontal size={20} /></summary><div id={id} role="group" aria-label={`Lesson actions for ${title}`} className="lesson-menu">{children}</div></details>;
}
