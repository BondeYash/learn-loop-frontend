import { ArrowUpRight, GraduationCap, Landmark, Monitor, ShieldCheck, TrainFront } from "lucide-react";
const pathways = [
  { name: "UPSC", detail: "Civil services", url: "https://www.upsc.gov.in/", image: "/images/upsc-mark.webp", icon: Landmark },
  { name: "SSC", detail: "CGL · CHSL · GD", url: "https://ssc.gov.in/", icon: ShieldCheck },
  { name: "Railways", detail: "RRB examinations", url: "https://www.rrbcdg.gov.in/", icon: TrainFront },
  { name: "Police", detail: "UP recruitment", url: "https://uppbpb.gov.in/", image: "/images/up-police-mark.webp", icon: ShieldCheck, police: true },
  { name: "NIELIT", detail: "CCC · O Level", url: "https://www.nielit.gov.in/", icon: Monitor },
  { name: "Teaching", detail: "CTET", url: "https://ctet.nic.in/", icon: GraduationCap },
];
export default function ExamPathways() {
  return <section className="exam-pathways" aria-labelledby="exam-pathways-title" data-reveal><div className="exam-pathways-heading"><div><p className="section-context">KEEP YOUR GOAL IN SIGHT</p><h2 id="exam-pathways-title">Bada goal. Agla step?</h2></div><p>Explore official exam portals.<br />Find available courses below.</p></div><div className="exam-pathways-list">{pathways.map(({ name, detail, url, image, icon: Icon, police }) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="exam-pathway"><span className={`exam-pathway-mark ${police ? "police-mark" : ""}`}>{image ? <img src={image} alt="" width={police ? 600 : 180} height={police ? 80 : 122} loading="lazy" /> : <Icon size={29} strokeWidth={1.6} aria-hidden="true" />}</span><strong>{name}</strong><span>{detail}</span><ArrowUpRight size={16} className="exam-pathway-arrow" aria-hidden="true" /><span className="sr-only"> (official website, opens in a new tab)</span></a>)}</div><p className="exam-pathways-note">Independent learning, with links to official exam resources.</p></section>;
}
