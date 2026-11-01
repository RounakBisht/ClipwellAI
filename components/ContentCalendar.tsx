"use client";
// M7: content calendar. "Up next" on top, an Apple-style month widget below.
// Click a date to see what's planned that day and log how posted clips did.
import { useMemo, useState } from "react";
import { IconBrandInstagram, IconBrandYoutube, IconCheck, IconChevronLeft, IconChevronRight, IconDownload, IconX } from "@tabler/icons-react";
import { replacePlanSlots, updateClip } from "@/lib/store";
import { useDialog } from "@/components/useDialog";
import type { Clip, PlanSlot, Platform } from "@/lib/types";

const BEST_TIME: Record<Platform, string> = { reels: "7:30 pm", shorts: "1:00 pm" };
const LABEL: Record<Platform, string> = { reels: "Reels", shorts: "Shorts" };
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Best clips first, one post a day for a week, alternating Reels and Shorts.
export function weekPlan(clips: Clip[], from = new Date()): Omit<PlanSlot, "id">[] {
  const ranked = [...clips].sort((a, b) => (b.score || 0) - (a.score || 0));
  if (!ranked.length) return [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1 + i);
    return { clip_id: ranked[i % ranked.length].id, platform: (i % 2 === 0 ? "reels" : "shorts") as Platform, day: ymd(d) };
  });
}

function PlatformIcon({ p, size = 16 }: { p: Platform; size?: number }) {
  return p === "reels" ? (
    <IconBrandInstagram size={size} stroke={1.8} className="text-[#d6336c]" aria-label="Reels" />
  ) : (
    <IconBrandYoutube size={size} stroke={1.8} className="text-[#e03131]" aria-label="Shorts" />
  );
}

export default function ContentCalendar({
  clips,
  slots,
  onSlots,
  onOutcome,
}: {
  clips: Clip[];
  slots: PlanSlot[];
  onSlots: (s: PlanSlot[]) => void;
  onOutcome: (clip: Clip, outcome: "great" | "ok" | "poor") => void;
}) {
  const today = ymd(new Date());
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState<string | null>(null);
  const dayRef = useDialog<HTMLDivElement>(Boolean(open), () => setOpen(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  function confirm(msg: string) {
    setSaved(msg);
    setTimeout(() => setSaved(""), 3000);
  }

  // Calendar export: one row per planned post, opens in Excel or Google Sheets.
  function exportCsv() {
    const esc = (v: string | number) => {
      const s = String(v);
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    const rows = [["Date", "Day", "Platform", "Post time", "Title", "Concept", "Length (s)", "Clip from", "Clip to"]];
    for (const s of slots) {
      const c = byId.get(s.clip_id);
      const d = parse(s.day);
      rows.push([
        s.day,
        d.toLocaleDateString("en-IN", { weekday: "short" }),
        LABEL[s.platform],
        BEST_TIME[s.platform],
        c?.title || "",
        c ? `${c.hook}. Why: ${c.reason}` : "",
        c ? String(Math.round(c.end_s - c.start_s)) : "",
        c ? fmt(c.start_s) : "",
        c ? fmt(c.end_s) : "",
      ]);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `clipwell-content-calendar-${ymd(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    confirm(`Exported ${slots.length} posts`);
  }

  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const byDay = useMemo(() => {
    const m = new Map<string, PlanSlot[]>();
    for (const s of slots) m.set(s.day, [...(m.get(s.day) || []), s]);
    return m;
  }, [slots]);
  const upcoming = slots.filter((s) => s.day >= today).slice(0, 2);

  const cells = useMemo(() => {
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
  }, [month]);

  async function plan() {
    setBusy(true);
    setError("");
    try {
      const rows = weekPlan(clips);
      const saved = await replacePlanSlots(clips.map((c) => c.id), rows);
      onSlots(saved);
      confirm(`Planned ${saved.length} posts`);
      if (saved[0]) {
        const d = parse(saved[0].day);
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function mark(clip: Clip, outcome: "great" | "ok" | "poor") {
    try {
      await updateClip(clip.id, { outcome });
      onOutcome(clip, outcome);
      confirm(`Saved: "${clip.title}" marked ${outcome === "ok" ? "OK" : outcome === "great" ? "Great" : "Poor"}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const fmtDay = (day: string) => parse(day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const daySlots = open ? byDay.get(open) || [] : [];

  return (
    <section className="surface relative overflow-hidden p-5" aria-label="Content calendar">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Content calendar</h2>
        <div className="flex items-center gap-1.5">
          {slots.length > 0 && (
            <button onClick={exportCsv} className="btn-press inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/10" title="Download as CSV for Excel or Google Sheets">
              <IconDownload size={14} aria-hidden="true" /> Export
            </button>
          )}
          <button
            onClick={plan}
            disabled={busy || !clips.length}
            className="btn-press rounded-full bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {busy ? "Planning…" : slots.length ? "Re-plan 7 days" : "Plan next 7 days"}
          </button>
        </div>
      </div>
      {saved && (
        <p role="status" className="animate-pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          <IconCheck size={14} aria-hidden="true" /> {saved}
        </p>
      )}

      {/* Upper window: what's on now, and what's next */}
      <div className="mt-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-ink to-teal-900 p-4 text-white">
        {upcoming.length ? (
          upcoming.map((s, i) => {
            const c = byId.get(s.clip_id);
            const d = parse(s.day);
            return (
              <div key={s.id} className={`flex items-center gap-3 ${i ? "mt-3 border-t border-white/10 pt-3 opacity-80" : ""}`}>
                <div className="flex w-11 shrink-0 flex-col items-center rounded-2xl bg-white/10 py-1.5">
                  <span className="text-[10px] font-semibold tracking-wide text-marigold uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="text-lg leading-none font-bold">{d.getDate()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-teal-200">{i === 0 ? (s.day === today ? "Today" : "Up next") : "Then"} · {BEST_TIME[s.platform]}</p>
                  <p className="truncate text-sm font-semibold">{c?.title || "Clip"}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-white/90 p-1.5"><PlatformIcon p={s.platform} /></span>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-teal-100">{clips.length ? "Nothing planned yet. Plan the next 7 days from your best clips." : "Find clips first, then plan your week here."}</p>
        )}
      </div>

      {/* Lower window: month view */}
      <div className="mt-4 rounded-[22px] bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold tracking-wide text-marigold-deep uppercase">
            {month.toLocaleDateString("en-IN", { month: "long" })} <span className="font-medium text-stone-500">{month.getFullYear()}</span>
          </p>
          <div className="flex gap-1">
            <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-1 text-stone-600 hover:bg-ink/5">
              <IconChevronLeft size={16} />
            </button>
            <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-1 text-stone-600 hover:bg-ink/5">
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-stone-500">
          {DOW.map((d, i) => (
            <span key={i} className="py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
          {cells.map((n, i) => {
            if (!n) return <span key={i} />;
            const day = ymd(new Date(month.getFullYear(), month.getMonth(), n));
            const items = byDay.get(day) || [];
            const isToday = day === today;
            return (
              <button
                key={i}
                onClick={() => setOpen(day)}
                aria-label={`${fmtDay(day)}${items.length ? `, ${items.length} planned` : ""}`}
                className={`relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full transition ${
                  isToday ? "bg-marigold font-bold text-ink" : open === day ? "bg-teal-700 text-white" : "hover:bg-ink/5"
                } ${items.length && !isToday && open !== day ? "font-semibold text-teal-800" : ""}`}
              >
                {n}
                {items.length > 0 && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isToday || open === day ? "bg-white" : "bg-teal-600"}`} />}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {/* Day pop-up */}
      {open && (
        <div ref={dayRef} tabIndex={-1} role="dialog" aria-label={`Plan for ${fmtDay(open)}`} className="animate-pop absolute outline-none inset-x-3 bottom-3 z-10 rounded-[22px] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(16,60,56,.55)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{fmtDay(open)}</p>
            <button aria-label="Close" onClick={() => setOpen(null)} className="rounded-full p-1 text-stone-500 hover:bg-ink/5">
              <IconX size={16} />
            </button>
          </div>
          {daySlots.length ? (
            <ul className="mt-3 space-y-3">
              {daySlots.map((s) => {
                const c = byId.get(s.clip_id);
                return (
                  <li key={s.id} className="surface-tint p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                      <PlatformIcon p={s.platform} size={14} /> {LABEL[s.platform]} · {BEST_TIME[s.platform]}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-ink">{c?.title || "Clip"}</p>
                    {c && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-stone-600">Posted? How did it do:</span>
                        {(["great", "ok", "poor"] as const).map((o) => (
                          <button
                            key={o}
                            onClick={() => mark(c, o)}
                            className={`rounded-full px-2.5 py-1 font-semibold capitalize ${
                              c.outcome === o ? (o === "great" ? "bg-teal-700 text-white" : o === "ok" ? "bg-marigold text-ink" : "bg-stone-700 text-white") : "chip-soft text-stone-700"
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-600">Nothing planned for this day.</p>
          )}
        </div>
      )}
    </section>
  );
}
