export default function LoadingSkeleton({ variant = "cards", label = "Loading courses…" }) {
  return <div className="mt-6" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className={variant === "cards" ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : variant === "stats" ? "grid grid-cols-2 gap-3 lg:grid-cols-4" : "space-y-4"}>
      {variant === "detail" ? <><div className="skeleton h-8 w-2/3" /><div className="skeleton h-4 w-5/6" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="skeleton aspect-video" /><div className="card space-y-4"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-12" /><div className="skeleton h-12" /></div></div></> : Array.from({ length: variant === "stats" ? 4 : 3 }, (_, index) => <div key={index} className="card space-y-4"><div className={`skeleton ${variant === "cards" ? "h-28" : "h-5 w-2/3"}`} /><div className="skeleton h-5 w-3/4" /><div className="skeleton h-4 w-1/2" /></div>)}
    </div>
  </div>;
}
