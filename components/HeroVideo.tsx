"use client";
// Muted hero loop that keeps playing: resumes after browser stalls or pauses, and only plays while on screen.
import { useEffect, useRef } from "react";

export default function HeroVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
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
  return <video ref={ref} className={className} src={src} poster={poster} autoPlay muted loop playsInline preload="auto" disablePictureInPicture />;
}
