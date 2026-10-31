"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractAudioChunks, getDuration, getFFmpeg, rememberFile } from "@/lib/media";
import { createProject } from "@/lib/store";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Segment, TranscriptLanguage, Word } from "@/lib/types";
import { YT_PREFIX, parsePastedTranscript, youtubeId } from "@/lib/youtube";
import { IconBrandYoutube, IconDownload, IconUpload } from "@tabler/icons-react";

const MAX_MINUTES = 240; // 4-hour podcasts are fine; audio is split into 5-minute parts

async function transcribeChunk(blob: Blob, offset: number, lang: TranscriptLanguage, part: string) {
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
    if (/rate.?limit|429|too many/i.test(`${json.error} ${json.detail}`) && rateWaits < 12) {
      rateWaits++;
      await new Promise((r) => setTimeout(r, 20000));
      continue;
    }
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(lastError);
}

export default function NewProject() {
  const router = useRouter();
  const [mode, setMode] = useState<"youtube" | "file">("youtube");
  const [link, setLink] = useState("");
  const ytId = youtubeId(link);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<TranscriptLanguage>("hinglish");
  const [busy, setBusy] = useState(false);
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
      setError((e as Error).message);
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
      router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setShowPaste(true);
      setBusy(false);
    }
  }

  // Fallback when YouTube blocks our server: the transcript copied from YouTube's own "Show transcript" panel.
  async function startPasted() {
    if (!ytId) return;
    const t = parsePastedTranscript(pasted);
    if (t.segments.length < 3) return setError("Couldn't find timestamps in that text. Copy the whole transcript panel, including the times.");
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
      router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setBusy(false);
    }
  }

  async function start() {
    if (!file) return;
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
              results[i] = await transcribeChunk(blob, offset, lang, `${i + 1} of ${total}`);
              transcribed++;
              bump();
            } catch (e) {
              failure = e as Error;
            }
          });
        },
        setStage,
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
      router.push(`/studio/p/${project.id}`);
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="surface p-6">
      <h2 className="text-lg font-semibold">New project</h2>
      <p className="mt-1 text-sm text-stone-600">
        Paste a YouTube link, or upload a podcast or long video of any length. Uploads stay on your laptop; only the audio is sent for transcription.
      </p>

      <div role="tablist" aria-label="Source" className="seg mt-5 inline-flex">
        {([["youtube", "YouTube link", IconBrandYoutube], ["file", "Upload a file", IconUpload]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            disabled={busy}
            onClick={() => setMode(k)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap sm:px-4 ${mode === k ? "seg-on text-teal-800" : "text-stone-600 hover:text-ink"}`}
          >
            <Icon size={16} stroke={1.8} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

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
      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-teal-700/25 bg-white/50 px-6 py-8 text-center hover:border-marigold hover:bg-marigold-soft/60">
        <input
          type="file"
          accept="video/*"
          className="hidden"
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
            <span className="font-medium">Choose a video file</span>
            <span className="mt-1 text-sm text-stone-500">MP4 works best. 720p keeps things fast.</span>
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
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

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
