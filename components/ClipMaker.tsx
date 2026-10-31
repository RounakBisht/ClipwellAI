"use client";
import { useEffect, useState } from "react";
import ClipPreview from "@/components/ClipPreview";
import { buildAss, buildSrt, clipWords, DEFAULT_CAPTION_STYLE, type CaptionStyle } from "@/lib/captions";
import { downloadBlob, exportClip, type Framing } from "@/lib/media";
import { fmtTime } from "@/lib/format";
import type { Word } from "@/lib/types";

function parseTime(s: string): number | null {
  const parts = s.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Manual clip: pick a start and end, preview it in 9:16 and export a captioned MP4.
// M4's AI picks reuse the same preview and export.
export default function ClipMaker({
  file,
  url,
  words,
  title,
  getCurrentTime,
  initial,
  style = DEFAULT_CAPTION_STYLE,
}: {
  file: File;
  url: string;
  words: Word[];
  title: string;
  getCurrentTime: () => number;
  initial?: { start: number; end: number };
  style?: CaptionStyle;
}) {
  const [startText, setStartText] = useState(fmtTime(initial?.start ?? 0));
  const [endText, setEndText] = useState(fmtTime(initial?.end ?? 30));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [framing, setFraming] = useState<Framing>("center");
  const effStyle: CaptionStyle = framing === "split" ? { ...style, position: "middle" } : style;

  useEffect(() => {
    if (initial) {
      setStartText(fmtTime(initial.start));
      setEndText(fmtTime(initial.end));
    }
  }, [initial]);

  const start = parseTime(startText);
  const end = parseTime(endText);
  const valid = start !== null && end !== null && end - start >= 5 && end - start <= 90;

  async function doExport() {
    if (!valid || start === null || end === null) return;
    setBusy(true);
    setError("");
    setNote("");
    setProgress(0.01);
    setStartedAt(Date.now());
    try {
      const rel = clipWords(words, start, end);
      const result = await exportClip(file, start, end, buildAss(rel, effStyle), setProgress, framing);
      const base = `${title.replace(/[^\w\- ]+/g, "").slice(0, 40).trim() || "clip"} ${fmtTime(start).replace(/:/g, "-")}`;
      downloadBlob(result.blob, `${base}.mp4`);
      if (!result.captioned) {
        downloadBlob(new Blob([buildSrt(rel, style.wordsPerLine)], { type: "text/plain" }), `${base}.srt`);
        setNote("Captions couldn't be burned in, so they're in a separate .srt file.");
      } else {
        setNote(`Exported in ${result.seconds.toFixed(0)} s · ${(result.blob.size / 1e6).toFixed(1)} MB`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
      {valid && start !== null && end !== null ? (
        <ClipPreview url={url} start={start} end={end} words={words} style={effStyle} framing={framing} className="w-full max-w-[240px]" />
      ) : (
        <div className="flex aspect-[9/16] w-full max-w-[240px] items-center justify-center rounded-2xl bg-stone-100 p-4 text-center text-sm text-stone-500">
          Pick a clip between 5 and 90 seconds long
        </div>
      )}
      <div>
        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-medium">Framing</span>
          <div className="inline-flex rounded-xl bg-cream p-1 ring-1 ring-sand" role="radiogroup" aria-label="Framing">
            {([
              ["center", "Centre"],
              ["left", "Left"],
              ["right", "Right"],
              ["split", "Split"],
            ] as [Framing, string][]).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={framing === k}
                onClick={() => setFraming(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${framing === k ? "bg-white text-teal-800 shadow-sm ring-1 ring-sand" : "text-stone-600 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Start</span>
            <div className="flex gap-2">
              <input value={startText} onChange={(e) => setStartText(e.target.value)} className="w-full rounded-lg border border-sand px-3 py-2 font-mono" />
              <button onClick={() => setStartText(fmtTime(getCurrentTime()))} className="shrink-0 rounded-lg px-2 text-xs ring-1 ring-sand hover:bg-stone-50">
                Now
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">End</span>
            <div className="flex gap-2">
              <input value={endText} onChange={(e) => setEndText(e.target.value)} className="w-full rounded-lg border border-sand px-3 py-2 font-mono" />
              <button onClick={() => setEndText(fmtTime(getCurrentTime()))} className="shrink-0 rounded-lg px-2 text-xs ring-1 ring-sand hover:bg-stone-50">
                Now
              </button>
            </div>
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Play the video above and press &ldquo;Now&rdquo; to mark the start and end, or type times like 12:05.
          {start !== null && end !== null && end > start && ` Length: ${Math.round(end - start)} s.`}
        </p>

        {busy && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-teal-700 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-stone-600" aria-live="polite">
              Rendering 9:16 MP4 with captions… {Math.round(progress * 100)}%
              {progress > 0.08 && startedAt > 0 && ` · about ${Math.max(1, Math.round(((Date.now() - startedAt) / 1000) * (1 - progress) / progress))} s left`}
            </p>
          </div>
        )}
        {note && <p className="mt-3 text-sm text-emerald-700">{note}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          onClick={doExport}
          disabled={!valid || busy}
          className="mt-4 w-full btn-press rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {busy ? "Exporting…" : "Export MP4 (9:16, captions burned in)"}
        </button>
        <p className="mt-2 text-xs text-stone-500">Rendering happens in your browser, so a 30 s clip takes roughly 30–60 s. Keep this tab open until the download starts.</p>
      </div>
    </div>
  );
}
