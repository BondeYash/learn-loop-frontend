import { BRAND_NAME } from "../config/brand.js";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { API_BASE } from "../services/axiosInstance.js";
function Image({ src }) {
  const [failed, setFailed] = useState(false);
  return !failed && <img className="course-image" src={src.startsWith("/api/") ? API_BASE + src.slice(4) : src} alt="" onError={() => setFailed(true)} />;
}
export default function CourseArtwork({ course, src, className = "" }) {
  const url = src || course?.thumbnail?.url;
  return <div className={`course-art ${className}`} aria-hidden="true"><div className="course-art-fallback"><span className="art-orbit art-orbit-one" /><span className="art-orbit art-orbit-two" /><span className="art-book"><BookOpen size={32} strokeWidth={1.4} /></span><span className="art-caption">{course?.category?.name || `${BRAND_NAME} course`}</span></div>{url && <Image key={url} src={url} />}</div>;
}
