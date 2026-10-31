"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractAudioChunks, getDuration, getFFmpeg, rememberFile } from "@/lib/media";
import { createProject } from "@/lib/store";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Segment, TranscriptLanguage, Word } from "@/lib/types";

const MAX_MINUTES = 60;

async function transcribeChunk(blob: Blob, offset: number, lang: TranscriptLanguage, part: string) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
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
    lastError = `${json.error || "Transcription failed"} (part ${part}, HTTP ${res.status})${json.detail ? ` — ${String(json.detail).slice(0, 200)}` : ""}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(lastError);
}

export default function NewProject() {
  const router = useRouter();
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
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">New project</h2>
      <p className="mt-1 text-sm text-stone-600">
        Upload a podcast or long video (MP4, up to 45 min). It stays on your laptop; only the audio is sent for transcription.
      </p>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 px-6 py-8 text-center hover:border-violet-400 hover:bg-violet-50/40">
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

      {file && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Project title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Spoken language</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as TranscriptLanguage)}
              disabled={busy}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
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
            <div className="h-full bg-violet-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-stone-600">{stage}…</p>
        </div>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={start}
        disabled={!file || busy}
        className="mt-5 w-full rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {busy ? "Working…" : "Transcribe video"}
      </button>
    </div>
  );
}
