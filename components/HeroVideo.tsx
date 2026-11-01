"use client";
// Muted hero loop that keeps playing: resumes after browser stalls or pauses, and only plays while on screen.
import { useEffect, useRef } from "react";

export default function HeroVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Respect reduced motion: show the poster frame instead of looping video.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      v.removeAttribute("autoplay");
      return;
    }
    let visible = true;
    const play = () => {
      if (visible && v.paused) v.play().catch(() => {});
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else v.pause();
    }, { threshold: 0.15 });
    io.observe(v);
    const onEnd = () => {
      v.currentTime = 0;
      play();
    };
    v.addEventListener("ended", onEnd);
    v.addEventListener("pause", play);
    v.addEventListener("stalled", play);
    v.addEventListener("canplay", play);
    const onVis = () => document.visibilityState === "visible" && play();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("pause", play);
      v.removeEventListener("stalled", play);
      v.removeEventListener("canplay", play);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <video ref={ref} aria-hidden="true" tabIndex={-1} className={className} src={src} poster={poster} autoPlay muted loop playsInline preload="auto" disablePictureInPicture />;
}
