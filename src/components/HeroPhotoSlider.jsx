import { useEffect, useState } from "react";
import { BookOpen, Pause, Play, Sparkles, ArrowUpRight } from "lucide-react";
import { ActionLink, Button } from "./Action.jsx";
import { coursePrice } from "../services/coursePrice.js";
const PHOTOS = [
  { src: "/images/student-focus.webp", alt: "A college student reading and making notes outdoors", width: 1000, height: 751, position: "50% center" },
  { src: "/images/student-at-desk.webp", alt: "A student taking a study break at her desk", width: 800, height: 1200, position: "50% 30%" },
];
export default function HeroPhotoSlider({ featuredCourse, loading }) {
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [visible, setVisible] = useState(!document.hidden), [loaded, setLoaded] = useState([false, false]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"), reduce = () => { if (media.matches) setPlaying(false); };
    const visibility = () => setVisible(!document.hidden);
    media.addEventListener("change", reduce); document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", reduce); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!playing || hovered || focused || !visible || !loaded.every(Boolean)) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % PHOTOS.length), 5000);
    return () => clearInterval(timer);
  }, [playing, hovered, focused, visible, loaded]);
  const next = PHOTOS[(index + 1) % PHOTOS.length];
  return <div className="hero-photo-stage" role="region" aria-roledescription="carousel" aria-label="Student study photos" data-slide={index + 1} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="hero-photo-backdrop" aria-hidden="true" />
    <div className="hero-main-photo">{PHOTOS.map((photo, i) => <img key={photo.src} className={i === index ? "hero-slide hero-slide-active" : "hero-slide"} src={photo.src} alt={i === index ? photo.alt : ""} aria-hidden={i !== index} width={photo.width} height={photo.height} fetchPriority={i === 0 ? "high" : "auto"} style={{ objectPosition: photo.position }} onLoad={() => setLoaded(current => current[i] ? current : current.map((value, n) => n === i || value))} />)}</div>
    <span className="hero-orbit" aria-hidden="true">✳</span><span className="hero-sticker"><Sparkles size={18} aria-hidden="true" />FUTURE YOU SAYS THANKS.</span>
    <div className="hero-mini-photo"><img src={next.src} alt="" aria-hidden="true" width={next.width} height={next.height} style={{ objectPosition: next.position }} /><span>One topic at a time.</span></div>
    <div className="hero-slider-controls" role="group" aria-label="Photo slide controls"><Button type="button" className="hero-slider-pause" aria-label={playing ? "Pause student photos" : "Play student photos"} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</Button><div className="hero-slider-dots">{PHOTOS.map((photo, i) => <Button key={photo.src} type="button" aria-label={`Show student photo ${i + 1}`} aria-pressed={index === i} disabled={!loaded[i]} onClick={() => setIndex(i)}><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="3" fill="currentColor" /></svg></Button>)}</div></div>
    <div className="hero-course-offer">{featuredCourse ? <><div><p className="hero-offer-label">YOUR NEXT CHAPTER</p><h2>{featuredCourse.title}</h2><p className="hero-offer-description">Learn at your own pace.</p></div><ActionLink to={`/catalog/${encodeURIComponent(featuredCourse.slug)}`} className="hero-price-link" aria-label="View course & enroll"><strong>{coursePrice(featuredCourse.amountMinor)}</strong><ArrowUpRight size={23} aria-hidden="true" /></ActionLink></> : loading ? <div role="status" aria-busy="true" className="hero-offer-skeleton"><span className="sr-only">Loading featured course…</span><div className="skeleton h-3 w-36" /><div className="skeleton mt-3 h-6 w-48" /></div> : <><BookOpen size={30} aria-hidden="true" /><div><p className="hero-offer-label">AAPKI MEHNAT. AAPKA FUTURE.</p><h2>Make a little progress today.</h2></div></>}</div>
  </div>;
}
