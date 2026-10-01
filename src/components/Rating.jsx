import { Star } from "lucide-react";
export default function Rating({ value = 0, count = 0 }) { return <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 dark:text-slate-300"><Star className="fill-accent-400 text-accent-400" size={16} />{value.toFixed(1)} <span className="text-slate-400">({count})</span></span>; }
