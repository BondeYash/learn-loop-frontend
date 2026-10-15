import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function LandingMotion({ root }) {
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".hero-reveal", { y: 28, opacity: 0, duration: .8, stagger: .1, ease: "power3.out", clearProps: "all" });
      gsap.from(".hero-photo-stage", { y: 24, opacity: 0, duration: 1, delay: .15, ease: "power3.out", clearProps: "all" });
      gsap.utils.toArray("[data-reveal]").forEach(element => {
        gsap.from(element, { y: 28, opacity: 0, duration: .7, ease: "power2.out", clearProps: "all", scrollTrigger: { trigger: element, start: "top 94%", once: true } });
      });
      gsap.fromTo(".hero-orbit", { rotation: -8 }, { rotation: 8, duration: 4, ease: "sine.inOut", clearProps: "transform" });
    });
    return () => media.revert();
  }, { scope: root });
  return null;
}
