"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { errorText, extractAudioChunks, getDuration, getFFmpeg, rememberFile } from "@/lib/media";
import { createProject } from "@/lib/store";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Segment, TranscriptLanguage, Word } from "@/lib/types";
import { YT_PREFIX, parsePastedTranscript, youtubeId } from "@/lib/youtube";
import { IconBrandYoutube, IconDownload, IconUpload } from "@tabler/icons-react";

const MAX_MINUTES = 240; // 4-hour podcasts are fine; audio is split into 5-minute parts

// Finished parts are kept for this tab, so a retry after a failure only sends the parts that are still missing.
const DONE = new Map<string, { words: Word[]; segments: Segment[] }>();
const RATE_WAIT_MS = 60_000;
const MAX_RATE_WAITS = 30;

async function transcribeChunk(blob: Blob, offset: number, lang: TranscriptLanguage, part: string, onWait?: (msg: string) => void) {
  let lastError = "";
  let rateWaits = 0;
  for (let attempt = 1; attempt <= 3 + rateWaits; attempt++) {
    const fd = new FormData();
    fd.append("file", blob, "chunk.mp3");
    fd.append("offset", String(offset));
    fd.append("lang", lang);
    let res: Response;
    try {
      res = await fetch("/api/transcribe", { method: "POST", body: fd });
    } catch {
      lastError = `Couldn't reach the transcription service for part ${part} (network error). If an ad blocker, VPN or privacy extension is on, pause it for this site and try again.`;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok) return json as { words: Word[]; segments: Segment[]; language: string | null };
    lastError = `${json.error || "Transcription failed"} (part ${part}, HTTP ${res.status})${json.detail ? `: ${String(json.detail).slice(0, 200)}` : ""}`;
    // Long podcasts can hit the transcription provider's hourly limit: wait and resume instead of failing.
    if (/rate.?limit|429|too many/i.test(`${json.error} ${json.detail}`) && rateWaits < MAX_RATE_WAITS) {
      rateWaits++;
      onWait?.(`The transcription service's hourly limit was reached at part ${part}. Finished parts are kept; continuing automatically in a minute (wait ${rateWaits} of ${MAX_RATE_WAITS})`);
      await new Promise((r) => setTimeout(r, RATE_WAIT_MS));
      continue;
    }
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  if (rateWaits >= MAX_RATE_WAITS) lastError += " The hourly transcription limit is still in effect. Click Transcribe again later; finished parts won't be redone.";
  throw new Error(lastError);
}

export default function NewProject() {
  const router = useRouter();
  const [mode, setMode] = useState<"youtube" | "file">("file");
  // If the user leaves the page mid-run, don't drag them to the new project later.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [link, setLink] = useState("");
  const ytId = youtubeId(link);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<TranscriptLanguage>("hinglish");
  const [busy, setBusy] = useState(false);
  // Warn before closing the tab mid-transcription (the work would be lost).
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function pick(f: File | null) {
    setError("");
    setFile(null);
    if (!f) return;
    try {
      const d = await getDuration(f);
      if (d > MAX_MINUTES * 60) throw new Error(`This video is ${fmtTime(d)} long. Please use one under ${MAX_MINUTES} minutes.`);
      setFile(f);
      setDuration(d);
      setTitle(f.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function startYoutube() {
    if (!ytId) return;
    setBusy(true);
    setError("");
    setProgress(0.3);
    setStage("Reading the video's captions from YouTube");
    try {
      const res = await fetch("/api/youtube", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: link, lang }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `YouTube import failed (HTTP ${res.status})`);
      setProgress(0.8);
      setStage("Saving the project");
      const project = await createProject({
        title: title || json.title,
        duration_s: Math.round(json.duration_s),
        language: lang,
        words: json.words,
        segments: json.segments,
        source_name: `${YT_PREFIX}${json.id}`,
        source_size: null,
      });
      setProgress(1);
      if (alive.current) router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError(errorText(e));
      setShowPaste(true);
      setBusy(false);
    }
  }

  // Fallback when YouTube blocks our server: the transcript copied from YouTube's own "Show transcript" panel.
  async function startPasted() {
    if (!ytId) return;
    const t = parsePastedTranscript(pasted);
    if (t.segments.length < 3)
      return setError(t.segments.length ? "That's only a couple of lines. Copy the whole transcript panel, including the times." : "Couldn't find timestamps in that text. Copy the whole transcript panel, including the times.");
    setBusy(true);
    setError("");
    setStage("Saving the project");
    setProgress(0.6);
    try {
      const project = await createProject({
        title: title || "YouTube video",
        duration_s: Math.round(t.duration),
        language: lang,
        words: t.words,
        segments: t.segments,
        source_name: `${YT_PREFIX}${ytId}`,
        source_size: null,
      });
      setProgress(1);
      if (alive.current) router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function start() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setProgress(0.02);
    try {
      setStage("Loading the video engine (about 30 MB, first time only)");
      await getFFmpeg();
      const results: { words: Word[]; segments: Segment[] }[] = [];
      let extracted = 0;
      let transcribed = 0;
      let totalChunks = 1;
      const bump = () => setProgress(0.05 + 0.9 * ((extracted + transcribed) / (2 * totalChunks)));
      // Uploads run one at a time (a queue), while audio extraction keeps going in parallel.
      let queue: Promise<void> = Promise.resolve();
      let failure: Error | null = null;

      const keyFor = (i: number) => `${file.name}|${file.size}|${file.lastModified}|${lang}|${i}`;
      await extractAudioChunks(
        file,
        duration,
        (blob, i, offset, total) => {
          totalChunks = total;
          extracted++;
          bump();
          queue = queue.then(async () => {
            if (failure) return;
            try {
              const key = keyFor(i);
              results[i] = DONE.get(key) || (await transcribeChunk(blob, offset, lang, `${i + 1} of ${total}`, setStage));
              DONE.set(key, results[i]);
              transcribed++;
              bump();
              setStage("Transcribing with word timings");
            } catch (e) {
              failure = e as Error;
            }
          });
        },
        setStage,
        { skip: (i) => DONE.has(keyFor(i)), shouldStop: () => Boolean(failure) },
      );
      setStage("Transcribing with word timings");
      await queue;
      if (failure) throw failure;

      const words = results.flatMap((r) => r?.words || []);
      const segments = results.flatMap((r) => r?.segments || []);
      if (!words.length) throw new Error("No speech was found in this video.");

      setStage("Saving the project");
      const project = await createProject({
        title: title || file.name,
        duration_s: Math.round(duration),
        language: lang,
        words,
        segments,
        source_name: file.name,
        source_size: file.size,
      });
      rememberFile(project.id, file);
      setProgress(1);
      if (alive.current) router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="surface p-6 sm:p-10">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">New project</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm text-stone-600 sm:text-base">
        Upload a podcast or long video (up to 4 hours), or paste a YouTube link. Uploads stay on your laptop; only the audio is sent for transcription.
      </p>

      <div className="mt-6 flex justify-center"><div role="tablist" aria-label="Source" className="seg inline-flex">
        {([["file", "Upload a file", IconUpload], ["youtube", "YouTube link", IconBrandYoutube]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            disabled={busy}
            onClick={() => {
              setMode(k);
              setTitle("");
              setError("");
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap sm:px-4 ${mode === k ? "seg-on text-teal-800" : "text-stone-600 hover:text-ink"}`}
          >
            <Icon size={16} stroke={1.8} aria-hidden="true" /> {label}
          </button>
        ))}
      </div></div>

      {mode === "youtube" && (
        <div className="mt-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">YouTube link</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={busy}
              placeholder="https://www.youtube.com/watch?v=…"
              className="field w-full px-3.5 py-2.5"
            />
          </label>
          {link && !ytId && <p className="mt-2 text-sm text-amber-800">That doesn&apos;t look like a YouTube video link yet.</p>}
          {ytId && (
            <div className="mt-4 overflow-hidden rounded-[22px] bg-black shadow-[0_20px_40px_-24px_rgba(16,60,56,.6)]">
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                title="YouTube preview"
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {ytId && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] bg-emerald-50/80 p-3">
              <a
                href={`https://studio.youtube.com/video/${ytId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="btn-press inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <IconDownload size={16} stroke={2} aria-hidden="true" /> Download the video
              </a>
              <p className="min-w-0 flex-1 text-xs leading-snug text-emerald-900">
                YouTube doesn&apos;t let other apps download videos, so this step happens on YouTube. If it&apos;s your channel, open it in YouTube Studio, click ⋮ then Download, and upload the file here to export MP4s.
              </p>
            </div>
          )}
          {ytId && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Project title (optional)</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="Uses the video title" className="field w-full px-3.5 py-2.5" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Spoken language</span>
                <select value={lang} onChange={(e) => setLang(e.target.value as TranscriptLanguage)} disabled={busy} className="field w-full px-3.5 py-2.5">
                  {(["hinglish", "en", "hi", "auto"] as TranscriptLanguage[]).map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABEL[l]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {ytId && (
            <div className="mt-4 rounded-[20px] bg-white/60 p-4">
              <button onClick={() => setShowPaste(!showPaste)} className="text-sm font-semibold text-teal-800 underline underline-offset-2" aria-expanded={showPaste}>
                {showPaste ? "Hide" : "YouTube blocked? Paste the transcript instead"}
              </button>
              {showPaste && (
                <div className="mt-3">
                  <p className="text-sm text-stone-700">
                    On YouTube, open the video description, click <b>Show transcript</b>, select all the text in the transcript panel (with the times), copy it and paste it here.
                  </p>
                  <textarea
                    rows={5}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    disabled={busy}
                    placeholder={"0:00\nSo today we're talking about…\n0:04\n…"}
                    className="field mt-2 w-full px-3.5 py-2.5 font-mono text-xs"
                  />
                  <button
                    onClick={startPasted}
                    disabled={busy || !pasted.trim()}
                    className="btn-press mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    Use this transcript
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "file" && (
      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-teal-700/25 bg-white/50 px-6 py-12 text-center focus-within:border-teal-700 focus-within:ring-4 focus-within:ring-teal-700/15 sm:py-16 hover:border-marigold hover:bg-marigold-soft/60">
        <input
          type="file"
          accept="video/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] || null)}
        />
        {file ? (
          <>
            <span className="font-medium">{file.name}</span>
            <span className="mt-1 text-sm text-stone-500">
              {fmtTime(duration)} · {(file.size / 1e6).toFixed(0)} MB · click to change
            </span>
          </>
        ) : (
          <>
            <IconUpload size={30} stroke={1.6} className="mb-2 text-teal-700" aria-hidden="true" />
            <span className="text-lg font-semibold">Choose a video file</span>
            <span className="mt-1 text-sm text-stone-600">MP4 works best. 720p keeps things fast. Up to 4 hours.</span>
          </>
        )}
      </label>

      )}

      {mode === "file" && file && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Project title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              className="field w-full px-3.5 py-2.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Spoken language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as TranscriptLanguage)}
              disabled={busy}
              className="field w-full px-3.5 py-2.5"
            >
              {(["hinglish", "en", "hi", "auto"] as TranscriptLanguage[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {busy && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-teal-700 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-stone-600">{stage}…</p>
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={mode === "youtube" ? startYoutube : start}
        disabled={busy || (mode === "youtube" ? !ytId : !file)}
        className="mt-5 w-full btn-press rounded-full bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {busy ? "Working…" : mode === "youtube" ? "Get transcript from YouTube" : "Transcribe video"}
      </button>
    </div>
  );
}
