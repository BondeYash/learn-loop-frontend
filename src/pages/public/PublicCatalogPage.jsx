import { Button } from "../../components/Action.jsx";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import StudyHero from "../../components/StudyHero.jsx";
import ExamPathways from "../../components/ExamPathways.jsx";

import "./LandingPage.css";
import CourseArtwork from "../../components/CourseArtwork.jsx";
import { publicCoursesResource, examNotificationsResource } from "../../services/publicContent.js";
import usePublicContent from "../../services/usePublicContent.js";
import LoadingSkeleton from "../../components/LoadingSkeleton.jsx";
import ExamNotifications from "../../components/ExamNotifications.jsx";
import { coursePrice } from "../../services/coursePrice.js";

function NoMotion() { return null; }
const LandingMotion = lazy(() => import("../../components/LandingMotion.jsx").catch(() => ({ default: NoMotion })));
const LandingSections = lazy(() => import("../../components/LandingSections.jsx"));

export default function PublicCatalogPage({ home = false }) {
  const landing = useRef(null);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "", category = params.get("category") || "", page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(q);
  const resource = publicCoursesResource({ q, category, page });
  const { data, waiting } = usePublicContent(resource);
  const feed = usePublicContent(examNotificationsResource, home);
  const featured = data?.courses.find(course => course.amountMinor > 0 && course.availability?.ready);
  useEffect(() => { setSearch(q); }, [q]);
  const filters = (changes) => { const next = new URLSearchParams(params); Object.entries(changes).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key)); setParams(next); };
  return <div ref={landing} className={home ? "landing-page" : "public-catalog"}>
    {home ? <StudyHero featuredCourse={featured} loading={!data} /> : <header className="catalog-intro mb-8"><p className="eyebrow">Government-exam learning</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Aaj kya padhein?</h1><p className="mt-3 text-muted">Apne next step ke liye course chunein. Syllabus aur sample dekhein, phir decide karein.</p></header>}
    {home && <ExamPathways />}
    <section id="catalog" aria-labelledby="catalog-heading" data-reveal><div className="flex flex-wrap items-end justify-between gap-4"><div>{home && <p className="section-context">Invest in your next step</p>}<h2 id="catalog-heading" className="text-2xl font-semibold">Explore courses</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{data ? `${data.total} ${data.total === 1 ? "course" : "courses"} available to explore` : "Published courses and their available samples"}</p></div>{home && <p className="landing-catalog-note">Choose your course. Make one payment. Start learning as soon as your payment is verified.</p>}</div>
      <form role="search" className="catalog-filters mt-6 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); filters({ q: search.trim(), page: "" }); }}><label className="min-w-0 flex-[2_1_220px] text-sm font-medium">Search courses<input className="input-field mt-2" type="search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course or exam name" /></label><label className="min-w-0 flex-[1_1_180px] text-sm font-medium">Category<select aria-label="Category" className="input-field mt-2" value={category} onChange={(event) => filters({ category: event.target.value, page: "" })}><option value="">All categories</option>{data?.categories?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Button className="btn-primary">Search</Button>{(q || category) && <Button className="btn-secondary" type="button" onClick={() => setParams({})}>Clear filters</Button>}</form>
      {!data && <><LoadingSkeleton label="Loading courses…" />{waiting && <p className="mt-3 text-sm text-muted" role="status">Getting your courses ready…</p>}</>}
      {data && !data.courses.length && <div className="card mt-6"><h3 className="font-semibold">{q || category || page > 1 ? "No courses match these filters" : "Courses will appear here when published"}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{q || category || page > 1 ? "Try another search or clear the filters to see available courses." : "No published, unarchived courses are available yet."}</p></div>}
      {data && <div className={`mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${home && data.courses.length === 1 ? "landing-course-grid-single" : ""}`}>{data.courses.map((course) => <article key={course.id} className="card course-card public-course-card flex min-w-0 flex-col !p-0 overflow-hidden"><CourseArtwork course={course} className="aspect-video w-full" /><div className="flex flex-1 flex-col p-5"><p className="course-category text-xs font-semibold text-primary-700 dark:text-primary-300">{course.examName || course.category?.name || "Course"}</p><h3 className="mt-2 break-words text-xl font-semibold"><Link className="hover:underline" to={`/catalog/${encodeURIComponent(course.slug)}`}>{course.title}</Link></h3>{course.summary && <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{course.summary}</p>}<div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">{course.language && <span>{course.language}</span>}{course.hasPreview && <span>Sample available</span>}<span>{!course.availability ? "Check availability" : !course.availability.ready ? "Materials being prepared" : course.availability.enrollment === "purchase" ? "Buy for instant access" : course.availability.enrollment === "public" ? "Open enrollment" : "Instructor assignment required"}</span></div><div className="course-purchase-block"><div><p className="course-price-caption">{course.amountMinor > 0 ? "One-time course price" : "Start your learning"}</p><strong className="course-sale-price">{coursePrice(course.amountMinor)}</strong></div><Link className={home ? "btn-primary gap-2" : "btn-secondary"} to={`/catalog/${encodeURIComponent(course.slug)}`}>{home && course.availability?.ready && course.amountMinor > 0 ? "View course & enroll" : "View course"}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>{home && course.availability?.ready && course.amountMinor > 0 && <p className="course-purchase-note"><CheckCircle2 size={15} aria-hidden="true" />Automatic access after verified payment</p>}</div></article>)}</div>}
      {data?.total > data?.limit && <nav aria-label="Course pages" className="mt-7 flex flex-wrap items-center justify-center gap-4"><Button className="btn-secondary" disabled={page <= 1} onClick={() => filters({ page: page - 1 })}>Previous</Button><span className="text-sm">Page {page} of {Math.ceil(data.total / data.limit)}</span><Button className="btn-secondary" disabled={page * data.limit >= data.total} onClick={() => filters({ page: page + 1 })}>Next</Button></nav>}
    </section>
    {home && <ExamNotifications feed={feed} />}
    {home && <Suspense fallback={<LoadingSkeleton variant="detail" label="Loading study guide…" />}><LandingSections /></Suspense>}
    {home && <Suspense fallback={null}><LandingMotion root={landing} /></Suspense>}
  </div>;
}
