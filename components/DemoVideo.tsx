"use client";
// Homepage demo: plays muted on loop while on screen; one tap turns the sound on.
import { useEffect, useRef, useState } from "react";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";

export default function DemoVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Reduced motion: no autoplay; the button below starts it with sound.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.3 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  function toggle() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  }
  return (
    <div className="relative h-full w-full">
      <video ref={ref} aria-label="ClipwellAI 30-second product demo" className="h-full w-full rounded-[22px] bg-ink object-cover" src={src} poster={poster} muted loop playsInline preload="metadata" />
      <button
        onClick={toggle}
        aria-label={muted ? "Turn sound on" : "Mute"}
        className="btn-press absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-ink"
      >
        {muted ? <IconVolumeOff size={16} aria-hidden="true" /> : <IconVolume size={16} aria-hidden="true" />}
        {muted ? "Sound on" : "Mute"}
      </button>
    </div>
  );
}
