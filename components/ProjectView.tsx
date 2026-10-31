"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addStyleCard, getProject, listPlanSlots } from "@/lib/store";
import { recallFile, rememberFile } from "@/lib/media";
import ClipMaker from "@/components/ClipMaker";
import BriefAndClips from "@/components/BriefAndClips";
import CopyPanel from "@/components/CopyPanel";
import StyleCardPanel, { loadStyle } from "@/components/StyleCardPanel";
import ContentCalendar from "@/components/ContentCalendar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { DEFAULT_CAPTION_STYLE, buildSrt, clipWords } from "@/lib/captions";
import { projectYoutubeId } from "@/lib/youtube";
import { IconBrandYoutube, IconDownload, IconPlayerPlay } from "@tabler/icons-react";
import { fmtTime, LANGUAGE_LABEL } from "@/lib/format";
import type { Brand, Clip, PlanSlot, Project, StyleCard } from "@/lib/types";

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
  const [clips, setClips] = useState<Clip[]>([]);
  const [slots, setSlots] = useState<PlanSlot[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<HTMLIFrameElement>(null);
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

  const ytId = projectYoutubeId(project?.source_name);

  // YouTube embed: listen for the player's time so the transcript can follow along.
  useEffect(() => {
    if (!ytId || file) return;
    function onMsg(e: MessageEvent) {
      if (!String(e.origin).includes("youtube")) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const t = d?.info?.currentTime;
        if (typeof t === "number") setNow(t);
      } catch {
        /* other messages */
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [ytId, file]);

  function ytCommand(func: string, args: unknown[] = []) {
    ytRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }

  function download(text: string, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const captionStyle = card?.fields.captionLook ?? DEFAULT_CAPTION_STYLE;

  function openClip(c: Clip) {
    setActiveClip(c);
    setClipInit({ start: c.start_s, end: c.end_s });
    makerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // "Find clips again" replaces the clip rows. Keep the open clip only if it still exists (same range), else close it,
  // so copy is never saved against a deleted clip.
  function syncClips(list: Clip[]) {
    setClips(list);
    listPlanSlots(list.map((c) => c.id)).then(setSlots).catch(() => setSlots([]));
    setActiveClip((a) => {
      if (!a) return a;
      return list.find((c) => c.id === a.id) || list.find((c) => Math.abs(c.start_s - a.start_s) < 0.5 && Math.abs(c.end_s - a.end_s) < 0.5) || null;
    });
  }

  // Results loop: a logged outcome updates the clip, and wins/flops become learnings on the style card,
  // which the next "Find clips" run reads.
  async function onOutcome(clip: Clip, outcome: "great" | "ok" | "poor") {
    setClips((list) => list.map((c) => (c.id === clip.id ? { ...c, outcome } : c)));
    if (outcome === "ok" || !brand || !card) return;
    const note = `${outcome === "great" ? "Worked" : "Flopped"}: "${clip.title}" (${Math.round(clip.end_s - clip.start_s)} s, hook "${clip.hook}")`;
    try {
      const next = await addStyleCard(brand.id, { ...card.fields, learnings: [...(card.fields.learnings || []).slice(-7), note] }, card.rules, `Learned from results: ${note}`);
      setCard(next);
      setStyleKey((k) => k + 1);
    } catch {
      /* the outcome is saved on the clip either way */
    }
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
    } else if (ytId) {
      ytCommand("seekTo", [t, true]);
      ytCommand("playVideo");
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

  const mismatch = file && !ytId && project.source_name && (file.name !== project.source_name || (project.source_size && file.size !== project.source_size));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/studio" className="text-sm text-stone-500 hover:text-teal-700">← All projects</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{project.title}</h1>
        <p className="text-sm text-stone-500">
          {fmtTime(project.duration_s)} · {LANGUAGE_LABEL[project.language] || project.language} · {project.words.length.toLocaleString()} words
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-[28px] bg-black shadow-[0_30px_60px_-30px_rgba(16,60,56,.65)]">
            {file ? (
              <video
                ref={videoRef}
                src={url}
                controls
                className="aspect-video w-full"
                onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
              />
            ) : ytId ? (
              <iframe
                ref={ytRef}
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1&rel=0&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`}
                title={project.title}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={() => ytRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*")}
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
          <div id="brief" className="mt-6 scroll-mt-24">
            <BriefAndClips project={project} url={url} brand={brand} card={card} captionStyle={captionStyle} onOpen={openClip} onClips={syncClips} />
          </div>
          <div id="maker" ref={makerRef} className="mt-6 scroll-mt-24 surface p-6">
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
            ) : ytId ? (
              <div className="surface-tint p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <IconBrandYoutube size={18} stroke={1.8} className="text-[#e03131]" aria-hidden="true" /> From YouTube
                  {clipInit && <span className="font-normal text-stone-600">· {fmtTime(clipInit.start)} to {fmtTime(clipInit.end)}</span>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={!clipInit}
                    onClick={() => clipInit && seek(clipInit.start)}
                    className="btn-press inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    <IconPlayerPlay size={16} aria-hidden="true" /> Play this clip
                  </button>
                  {clipInit && (
                    <a
                      href={`https://youtu.be/${ytId}?t=${Math.floor(clipInit.start)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-press rounded-full bg-ink/5 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/10"
                    >
                      Open on YouTube at {fmtTime(clipInit.start)}
                    </a>
                  )}
                  {clipInit && (
                    <button
                      onClick={() => download(buildSrt(clipWords(project.words, clipInit.start, clipInit.end), captionStyle.wordsPerLine), `${(activeClip?.title || "clip").replace(/[^\w]+/g, "-")}.srt`)}
                      className="btn-press inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/10"
                    >
                      <IconDownload size={16} aria-hidden="true" /> Clip captions (.srt)
                    </button>
                  )}
                </div>
                <label className="mt-4 block cursor-pointer rounded-2xl bg-white/70 px-4 py-3 text-sm text-stone-700 hover:bg-white">
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => reselect(e.target.files?.[0] || null)} />
                  <span className="font-semibold text-teal-800">Add the video file</span> to preview in 9:16 and export captioned MP4s. YouTube doesn&apos;t allow downloading videos, so the file has to come from you.
                </label>
              </div>
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
              <p className="mt-6 border-t border-ink/8 pt-4 text-sm text-stone-500">Shorts and Reels copy appears here once you open an AI clip with &ldquo;Edit and export&rdquo;.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div id="stylecard" className="scroll-mt-24">
            <StyleCardPanel compact refreshKey={styleKey} />
          </div>
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink/8 px-5 py-3">
              <h2 className="text-sm font-semibold">Transcript <span className="font-normal text-stone-600">· click a line to clip</span></h2>
              <div className="flex gap-1">
                <button
                  onClick={() => download(project.segments.map(([t, st]) => `[${fmtTime(st)}] ${t}`).join("\n"), `${project.title.replace(/[^\w]+/g, "-")}-transcript.txt`)}
                  className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-ink/10"
                  title="Download transcript as text"
                >
                  .txt
                </button>
                <button
                  onClick={() => download(buildSrt(project.words, 7), `${project.title.replace(/[^\w]+/g, "-")}.srt`)}
                  className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-ink/10"
                  title="Download transcript as subtitles"
                >
                  .srt
                </button>
              </div>
            </div>
            <ol className="max-h-[420px] overflow-y-auto px-2 py-2 text-sm">
              {project.segments.map(([text, s, e], i) => {
                const active = now >= s && now < e;
                return (
                  <li key={i}>
                    <button
                      onClick={() => seek(s)}
                      className={`flex w-full gap-3 rounded-2xl px-3 py-2 text-left hover:bg-white/80 ${active ? "bg-teal-50" : ""}`}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-stone-500">{fmtTime(s)}</span>
                      <span className={active ? "text-teal-900" : "text-stone-700"}>{text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <div id="calendar" className="scroll-mt-24">
            <ContentCalendar clips={clips} slots={slots} onSlots={setSlots} onOutcome={onOutcome} />
          </div>
        </div>
      </div>
      <SuggestionsPanel clips={clips} slots={slots} card={card} caption={captionStyle} />
    </div>
  );
}
