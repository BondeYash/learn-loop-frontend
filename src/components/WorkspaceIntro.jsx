import { Sparkles } from "lucide-react";
export default function WorkspaceIntro({ eyebrow, title, children }) {
  return <header className="workspace-intro"><div className="min-w-0"><p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />{eyebrow}</p><h1>{title}</h1><div className="workspace-description">{children}</div></div><span className="intro-spark" aria-hidden="true"><Sparkles size={36} strokeWidth={1.7} /></span></header>;
}
