import { useState } from "react";
import { ArrowUpRight, BellRing, CalendarDays, Search } from "lucide-react";
import "./ExamNotifications.css";

function dateLabel(value, withTime = false) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }).format(date);
}

export default function ExamNotifications({ feed }) {
  const { data, waiting } = feed;
  const loading = !data;
  const [query, setQuery] = useState(""), [expanded, setExpanded] = useState(false);
  // A key is optional: keep the public home page tidy until the owner enables it.
  if (data?.enabled === false) return null;
  const notices = data?.notices || [];
  const matching = notices.filter(notice => notice.title.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = expanded ? matching : matching.slice(0, 6);
  const updated = dateLabel(data?.updatedAt, true);
  return <section id="exam-updates" className="exam-updates" aria-labelledby="exam-updates-title">
    <div className="exam-updates-heading">
      <div><p className="section-context"><BellRing size={16} aria-hidden="true" />Stay informed. Plan your next step.</p><h2 id="exam-updates-title">Latest exam notifications</h2><p className="exam-updates-intro">Exam and recruitment updates from SarkariResult.com.cm.</p></div>
      {updated && <p className="exam-updates-freshness">Last updated<time dateTime={data.updatedAt}>{updated} IST</time></p>}
    </div>
    <p className="exam-updates-source">Third-party updates via Parse. Confirm dates and eligibility in the recruiting authority’s official notice before applying.</p>
    {loading && <div className="exam-feed-skeleton" role="status" aria-busy="true"><span className="sr-only">Loading exam updates…</span><div className="exam-notice-list" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="exam-notice-placeholder" key={index}><div className="skeleton h-3 w-28" /><div className="skeleton mt-4 h-5 w-5/6" /><div className="skeleton mt-2 h-4 w-2/3" /></div>)}</div>{waiting && <p className="exam-connecting">Gathering the latest updates…</p>}</div>}
    {!loading && notices.length > 0 && <>
      <label className="exam-update-search"><span>Find an exam in these updates</span><div><Search size={18} aria-hidden="true" /><input type="search" value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setExpanded(false); }} placeholder="Try SSC, railway or banking" /></div></label>
      <p className="exam-update-count" role="status">{matching.length} {matching.length === 1 ? "update" : "updates"}{query.trim() ? " matching your search" : " in the latest feed"}</p>
      <ul className="exam-notice-list">{visible.map(notice => <li key={notice.id}>
        <div>{dateLabel(notice.publishedOn) && <p className="exam-notice-date"><CalendarDays size={14} aria-hidden="true" /><span>Published <time dateTime={notice.publishedOn}>{dateLabel(notice.publishedOn)}</time></span></p>}<h3><a href={notice.url} target="_blank" rel="noopener noreferrer">{notice.title}<ArrowUpRight size={20} aria-hidden="true" /><span className="sr-only"> (opens source in a new tab)</span></a></h3></div>
      </li>)}</ul>
      {matching.length === 0 && <p className="exam-updates-state">No matching update in this feed. Try another exam name.</p>}
      {matching.length > 6 && <button type="button" className="btn-secondary exam-updates-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer updates" : `Show all ${matching.length} updates`}</button>}
    </>}
    {!loading && data?.status === "ready" && !notices.length && <p className="exam-updates-state">No new notifications are available in the current feed. Check back later.</p>}
  </section>;
}
