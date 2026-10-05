import { Sparkles } from "lucide-react";
export default function WorkspaceIntro({ eyebrow, title, children }) {
  return <header className="workspace-intro"><div className="min-w-0"><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 break-words text-3xl font-bold leading-tight sm:text-4xl">{title}</h1><div className="mt-3 max-w-2xl text-sm leading-7 text-muted">{children}</div></div><Sparkles aria-hidden="true" className="intro-spark" size={42} strokeWidth={1.5} /></header>;
}
