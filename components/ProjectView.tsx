"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getProject } from "@/lib/store";
import { recallFile, rememberFile } from "@/lib/media";
import ClipMaker from "@/components/ClipMaker";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Project } from "@/lib/types";

export default function ProjectView({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [clipInit, setClipInit] = useState<{ start: number; end: number } | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    getProject(id).then(setProject).catch((e) => setError(e.message));
    setFile(recallFile(id));
  }, [id]);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function reselect(f: File | null) {
    if (!f) return;
    rememberFile(id, f);
    setFile(f);
  }

  function seek(t: number) {
    const v = videoRef.current;
    if (v) {
      v.currentTime = t;
      v.play().catch(() => {});
    }
    if (project) setClipInit({ start: t, end: Math.min(t + 30, project.duration_s) });
  }

  if (error) return <p className="mx-auto max-w-6xl px-6 py-8 text-red-700">{error}</p>;
  if (project === undefined) return <p className="mx-auto max-w-6xl px-6 py-8 text-stone-500">Loading project…</p>;
  if (project === null)
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p>Project not found.</p>
        <Link href="/studio" className="text-teal-700">Back to the studio</Link>
      </div>
    );

  const mismatch = file && project.source_name && (file.name !== project.source_name || (project.source_size && file.size !== project.source_size));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/studio" className="text-sm text-stone-500 hover:text-teal-700">← All projects</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
        <p className="text-sm text-stone-500">
          {fmtTime(project.duration_s)} · {LANGUAGE_LABEL[project.language] || project.language} · {project.words.length.toLocaleString()} words
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-sand">
            {file ? (
              <video
                ref={videoRef}
                src={url}
                controls
                className="aspect-video w-full"
                onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
              />
            ) : (
              <label className="flex aspect-video cursor-pointer flex-col items-center justify-center bg-stone-900 px-6 text-center text-stone-200">
                <input type="file" accept="video/*" className="hidden" onChange={(e) => reselect(e.target.files?.[0] || null)} />
                <span className="font-medium">Select the same video file to preview and export</span>
                <span className="mt-1 text-sm text-stone-400">{project.source_name || "The original upload"}</span>
              </label>
            )}
          </div>
          {mismatch && (
            <p className="mt-2 text-sm text-amber-700">
              This file looks different from the one you transcribed ({project.source_name}). Clips may not line up.
            </p>
          )}
          <div className="mt-6 rounded-3xl bg-white p-6 shadow-[0_1px_0_#f1e4cc,0_12px_30px_-20px_rgba(23,38,42,.25)] ring-1 ring-sand">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Make a clip</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">AI picks arrive in M4</span>
            </div>
            <p className="mt-1 mb-5 text-sm text-stone-600">Click a transcript line to start a clip there, preview it in 9:16 and export an MP4 with captions.</p>
            {file ? (
              <ClipMaker
                file={file}
                url={url}
                words={project.words}
                title={project.title}
                initial={clipInit}
                getCurrentTime={() => videoRef.current?.currentTime ?? 0}
              />
            ) : (
              <p className="text-sm text-amber-700">Select the video file above to make clips.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-sand">
            <h2 className="border-b border-stone-100 px-5 py-3 text-sm font-semibold">Transcript</h2>
            <ol className="max-h-[560px] overflow-y-auto px-2 py-2 text-sm">
              {project.segments.map(([text, s, e], i) => {
                const active = now >= s && now < e;
                return (
                  <li key={i}>
                    <button
                      onClick={() => seek(s)}
                      className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-stone-50 ${active ? "bg-teal-50" : ""}`}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-stone-400">{fmtTime(s)}</span>
                      <span className={active ? "text-teal-900" : "text-stone-700"}>{text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
