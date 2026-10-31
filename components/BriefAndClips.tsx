"use client";
import { useEffect, useState } from "react";
import ClipPreview from "@/components/ClipPreview";
import { listClips, replaceClips, updateProject } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import type { CaptionStyle } from "@/lib/captions";
import type { Brand, Clip, Project, StyleCard } from "@/lib/types";

export default function BriefAndClips({
  project,
  url,
  brand,
  card,
  captionStyle,
  onOpen,
  onClips,
}: {
  project: Project;
  url: string;
  brand: Brand | null;
  card: StyleCard | null;
  captionStyle: CaptionStyle;
  onOpen: (clip: Clip) => void;
  onClips?: (clips: Clip[]) => void;
}) {
  const [brief, setBrief] = useState(project.brief || "");
  const [count, setCount] = useState(4);
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listClips(project.id)
      .then((c) => {
        setClips(c);
        onClips?.(c);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function find() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/clips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief,
          count,
          duration: project.duration_s,
          segments: project.segments,
          brand: brand ? { name: brand.name, sells: brand.sells, audience: brand.audience } : undefined,
          style: card
            ? {
                tone: card.fields.tone,
                hookStyle: card.fields.hookStyle,
                rules: card.rules.filter((r) => r.active).map((r) => r.text),
                learnings: (card.fields as unknown as { learnings?: string[] }).learnings || [],
              }
            : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Couldn't find clips (${res.status}).`);
      const saved = await replaceClips(
        project.id,
        (json.clips as { start: number; end: number; title: string; hook: string; reason: string; score: number }[]).map((c, i) => ({
          idx: i,
          start_s: c.start,
          end_s: c.end,
          title: c.title,
          hook: c.hook,
          reason: c.reason,
          score: c.score,
          outcome: null,
        })),
      );
      await updateProject(project.id, { brief });
      setClips(saved);
      onClips?.(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Brief and AI clips</h2>
        {card ? (
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">Using style card v{card.version}</span>
        ) : (
          <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-xs font-semibold text-marigold-deep">No style card yet</span>
        )}
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1 flex items-center gap-2 font-medium">
          Your brief
          <span className="rounded-full bg-marigold-soft px-2.5 py-0.5 text-xs font-medium text-marigold-deep">Speak it with Wispr</span>
        </span>
        <textarea
          rows={3}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. Clips for new plant parents, uh, keep it fun, no wait, practical. Avoid anything too technical."
          className="field w-full px-3.5 py-2.5"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-stone-600">Clips</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="field px-3 py-2">
            {[3, 4, 5].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={find} disabled={busy} className="btn-press flex-1 rounded-full bg-teal-700 px-5 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
          {busy ? "Reading the whole transcript…" : clips?.length ? "Find clips again" : "Find clips"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {clips && clips.length > 0 && (
        <div className="mt-6 grid gap-4">
          {clips.map((c, i) => (
            <div key={c.id} className="animate-rise lift surface-tint flex gap-4 p-3" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="w-[130px] shrink-0">
                {url ? (
                  <ClipPreview url={url} start={c.start_s} end={c.end_s} words={project.words} style={captionStyle} className="w-full" />
                ) : project.source_name?.startsWith("youtube:") ? (
                  <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://i.ytimg.com/vi/${project.source_name.slice(8)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90" />
                    <span className="absolute inset-x-1 bottom-2 text-center font-caption text-[13px] leading-tight font-extrabold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">{c.hook}</span>
                  </div>
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center rounded-2xl bg-ink/5 p-2 text-center text-xs text-stone-600">Select the video to preview</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base leading-snug font-bold text-ink">{c.title}</h3>
                  <span className="shrink-0 rounded-full bg-marigold px-2 py-0.5 text-xs font-bold text-ink" title="AI score out of 100: hook strength, clarity and fit with your brief" aria-label={`AI score ${c.score} out of 100`}>{c.score}</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {fmtTime(c.start_s)} to {fmtTime(c.end_s)} · {Math.round(c.end_s - c.start_s)} s
                </p>
                <p className="mt-2 text-sm font-semibold text-teal-800">&ldquo;{c.hook}&rdquo;</p>
                <p className="mt-1 text-sm text-stone-700">
                  <span className="font-semibold text-stone-500">Why: </span>
                  {c.reason}
                </p>
                <button onClick={() => onOpen(c)} className="btn-press mt-3 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-teal-800">
                  Edit and export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
