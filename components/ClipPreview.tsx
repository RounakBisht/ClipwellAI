"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { captionAt, clipWords, phrases, type CaptionStyle } from "@/lib/captions";
import type { Word } from "@/lib/types";
import { SPEAKER_X, type Framing } from "@/lib/media";

// A live 9:16 preview: the centre of the video, with word-by-word captions drawn on top.
// It mirrors what the MP4 export burns in, without encoding anything.
export default function ClipPreview({
  url,
  start,
  end,
  words,
  style,
  framing = "center",
  className = "",
}: {
  url: string;
  start: number;
  end: number;
  words: Word[];
  style: CaptionStyle;
  framing?: Framing;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const groups = useMemo(() => phrases(clipWords(words, start, end), style.wordsPerLine), [words, start, end, style.wordsPerLine]);
  const cap = captionAt(groups, t);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const seek = () => {
      v.currentTime = start;
      setT(0);
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener("loadedmetadata", seek, { once: true });
    v.pause();
    setPlaying(false);
  }, [start, end, url]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start;
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  // Split screen: draw the left half of the source on top and the right half below, like the export.
  useEffect(() => {
    if (framing !== "split") return;
    let raf = 0;
    const draw = () => {
      const v = ref.current;
      const c = canvas.current;
      if (v && c && v.videoWidth) {
        const cw = c.clientWidth * (window.devicePixelRatio || 1);
        const ch = (cw * 16) / 9;
        if (c.width !== Math.round(cw)) {
          c.width = Math.round(cw);
          c.height = Math.round(ch);
        }
        const ctx = c.getContext("2d");
        if (ctx) {
          const W = v.videoWidth;
          const H = v.videoHeight;
          const sw = Math.min(W / 2, (H * 9) / 8);
          const sh = (sw * 8) / 9;
          const sy = (H - sh) * 0.35;
          ctx.drawImage(v, 0, sy, sw, sh, 0, 0, c.width, c.height / 2);
          ctx.drawImage(v, W - sw, sy, sw, sh, 0, c.height / 2, c.width, c.height / 2);
          ctx.fillStyle = "rgba(0,0,0,.85)";
          ctx.fillRect(0, c.height / 2 - (4 * c.width) / 720, c.width, (8 * c.width) / 720);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [framing, url]);

  const visible = (9 / 16) / aspect; // fraction of the source width a 9:16 window shows
  const cx = framing === "left" ? SPEAKER_X.left : framing === "right" ? SPEAKER_X.right : 0.5;
  const objX = visible >= 1 ? 50 : Math.min(100, Math.max(0, ((cx - visible / 2) / (1 - visible)) * 100));
  const capPos = framing === "split" ? "middle" : style.position;

  // Scale captions from the 720-wide export frame to the preview's width.
  const [w, setW] = useState(270);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const k = w / 720;

  return (
    <div ref={box} className={`relative aspect-[9/16] overflow-hidden rounded-2xl bg-black ${className}`}>
      <video
        ref={ref}
        src={url}
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${framing === "split" ? "opacity-0" : ""}`}
        style={{ objectPosition: `${objX}% 50%` }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.currentTime >= end) {
            v.pause();
            v.currentTime = start;
            setPlaying(false);
          }
          setT(Math.max(0, v.currentTime - start));
        }}
      />
      {framing === "split" && <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
      {cap && (
        <div
          className="pointer-events-none absolute inset-x-0 px-[8%] text-center leading-tight"
          style={{
            fontFamily: '"Baloo 2", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: style.fontSize * k,
            color: style.textColor,
            textTransform: style.uppercase ? "uppercase" : "none",
            WebkitTextStroke: `${Math.max(1, 5 * k)}px #000`,
            paintOrder: "stroke fill",
            textShadow: `0 ${2 * k}px ${4 * k}px rgba(0,0,0,.5)`,
            ...(capPos === "middle" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: `${(300 / 1280) * 100}%` }),
          }}
        >
          {cap.words.map((wd, i) => (
            <span key={i}>
              <span style={i === cap.active ? { color: style.highlightColor, display: "inline-block", transform: "scale(1.08)" } : undefined}>
                {wd[0]}
              </span>
              {i < cap.words.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
      )}
      <button
        onClick={toggle}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/10"
      >
        {!playing && (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
