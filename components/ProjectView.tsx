"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getProject } from "@/lib/store";
import { recallFile, rememberFile } from "@/lib/media";
import ClipMaker from "@/components/ClipMaker";
import BriefAndClips from "@/components/BriefAndClips";
import CopyPanel from "@/components/CopyPanel";
import StyleCardPanel, { loadStyle } from "@/components/StyleCardPanel";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Brand, Clip, Project, StyleCard } from "@/lib/types";

export default function ProjectView({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | undefined>(undefined);
  const [now, setNow] = useState(0);
  const [clipInit, setClipInit] = useState<{ start: number; end: number } | undefined>(undefined);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [card, setCard] = useState<StyleCard | null>(null);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [styleKey, setStyleKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const makerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProject(id).then(setProject).catch((e) => setError(e.message));
    setFile(recallFile(id));
    loadStyle()
      .then(({ brand, cards }) => {
        setBrand(brand);
        setCard(cards[0] || null);
      })
      .catch(() => {});
  }, [id]);

  const captionStyle = card?.fields.captionLook ?? DEFAULT_CAPTION_STYLE;

  function openClip(c: Clip) {
    setActiveClip(c);
    setClipInit({ start: c.start_s, end: c.end_s });
    makerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // "Find clips again" replaces the clip rows. Keep the open clip only if it still exists (same range), else close it,
  // so copy is never saved against a deleted clip.
  function syncClips(list: Clip[]) {
    setActiveClip((a) => {
      if (!a) return a;
      return list.find((c) => c.id === a.id) || list.find((c) => Math.abs(c.start_s - a.start_s) < 0.5 && Math.abs(c.end_s - a.end_s) < 0.5) || null;
    });
  }

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
        <h1 className="text-3xl font-extrabold text-ink">{project.title}</h1>
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
          <div className="mt-6">
            <BriefAndClips project={project} url={url} brand={brand} card={card} captionStyle={captionStyle} onOpen={openClip} onClips={syncClips} />
          </div>
          <div ref={makerRef} className="mt-6 scroll-mt-24 rounded-3xl bg-white p-6 shadow-[0_1px_0_#f1e4cc,0_12px_30px_-20px_rgba(23,38,42,.25)] ring-1 ring-sand">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{activeClip ? activeClip.title : "Edit and export"}</h2>
              {activeClip && <span title="AI score out of 100: hook strength, clarity and fit with your brief" className="shrink-0 rounded-full bg-marigold px-2 py-0.5 text-xs font-bold text-ink">Score {activeClip.score}</span>}
            </div>
            <p className="mt-1 mb-5 text-sm text-stone-600">
              {activeClip ? activeClip.reason : "Pick an AI clip above, or click a transcript line to start your own. Preview it in 9:16 and export an MP4 with captions."}
            </p>
            {file ? (
              <ClipMaker
                file={file}
                url={url}
                words={project.words}
                title={activeClip?.title || project.title}
                initial={clipInit}
                style={captionStyle}
                getCurrentTime={() => videoRef.current?.currentTime ?? 0}
              />
            ) : (
              <p className="text-sm text-amber-700">Select the video file above to make clips.</p>
            )}
            {activeClip ? (
              <CopyPanel
                key={activeClip.id}
                clip={activeClip}
                project={project}
                brand={brand}
                card={card}
                onLearned={(c) => {
                  setCard(c);
                  setStyleKey((k) => k + 1);
                }}
              />
            ) : (
              <p className="mt-6 border-t border-sand pt-4 text-sm text-stone-500">Shorts and Reels copy appears here once you open an AI clip with &ldquo;Edit and export&rdquo;.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <StyleCardPanel compact refreshKey={styleKey} />
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-sand lg:sticky lg:top-20">
            <h2 className="border-b border-sand px-5 py-3 text-sm font-semibold">Transcript · click a line to clip from there</h2>
            <ol className="max-h-[560px] overflow-y-auto px-2 py-2 text-sm">
              {project.segments.map(([text, s, e], i) => {
                const active = now >= s && now < e;
                return (
                  <li key={i}>
                    <button
                      onClick={() => seek(s)}
                      className={`flex w-full gap-3 rounded-lg px-3 py-2 text-left hover:bg-stone-50 ${active ? "bg-teal-50" : ""}`}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-stone-500">{fmtTime(s)}</span>
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
