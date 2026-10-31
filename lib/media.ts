"use client";
// Browser-side video work with ffmpeg.wasm. The video file never leaves the laptop.
import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (!loading) {
    loading = (async () => {
      const f = new FFmpeg();
      if (onLog) f.on("log", ({ message }) => onLog(message));
      const base = `${window.location.origin}/ffmpeg`;
      // The worker is served as a plain file (not bundled) so it can import the engine natively.
      await f.load({
        classWorkerURL: `${base}/worker.js`,
        coreURL: `${base}/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg-core.wasm`,
      });
      ffmpeg = f;
      return f;
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

// Files picked in this session, so a project page can play and export without re-picking.
const files = new Map<string, File>();
export function rememberFile(projectId: string, file: File) {
  files.set(projectId, file);
}
export function recallFile(projectId: string): File | undefined {
  return files.get(projectId);
}

export function getDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!isFinite(d) || d <= 0) reject(new Error("Couldn't read the video's length."));
      else resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file doesn't look like a video the browser can read. Try an MP4."));
    };
    v.src = url;
  });
}

let mountCount = 0;
async function mountFile(f: FFmpeg, file: File): Promise<{ path: string; dir: string }> {
  const dir = `/in${++mountCount}`;
  await f.createDir(dir);
  await f.mount("WORKERFS" as Parameters<FFmpeg["mount"]>[0], { files: [file] }, dir);
  return { path: `${dir}/${file.name}`, dir };
}
async function unmount(f: FFmpeg, dir: string) {
  try {
    await f.unmount(dir);
    await f.deleteDir(dir);
  } catch {
    /* ignore */
  }
}

export const CHUNK_SECONDS = 300; // 5 min of 32 kbps mono MP3 ≈ 1.2 MB, far under Vercel's 4.5 MB request limit

// Extracts the audio in 10-minute MP3 chunks and hands each one over as soon as it's ready.
export async function extractAudioChunks(
  file: File,
  duration: number,
  onChunk: (blob: Blob, index: number, offset: number, total: number) => void,
  onStage?: (text: string) => void,
): Promise<void> {
  const f = await getFFmpeg();
  const { path, dir } = await mountFile(f, file);
  try {
    const total = Math.ceil(duration / CHUNK_SECONDS);
    for (let i = 0; i < total; i++) {
      const start = i * CHUNK_SECONDS;
      const len = Math.min(CHUNK_SECONDS, duration - start);
      onStage?.(`Extracting audio ${i + 1} of ${total}`);
      const out = `chunk${i}.mp3`;
      const code = await f.exec([
        "-ss", start.toFixed(2), "-t", len.toFixed(2), "-i", path,
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", out,
      ]);
      if (code !== 0) throw new Error(`Audio extraction failed on part ${i + 1}.`);
      const data = (await f.readFile(out)) as Uint8Array;
      await f.deleteFile(out);
      onChunk(new Blob([data.slice().buffer], { type: "audio/mpeg" }), i, start, total);
    }
  } finally {
    await unmount(f, dir);
  }
}

export { mountFile, unmount };
