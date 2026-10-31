"use client";
// Suggestions: a small window that checks every key area of the studio and says what to do next.
import { useState } from "react";
import { IconBulb, IconCalendarStats, IconChartBar, IconCut, IconMessage2, IconScissors, IconTypography, IconX } from "@tabler/icons-react";
import type { CaptionLook, Clip, PlanSlot, StyleCard } from "@/lib/types";
import { ymd } from "@/components/ContentCalendar";

type Tip = { area: string; icon: typeof IconBulb; ok: boolean; text: string; target?: string; action?: string };

export function buildTips({ clips, slots, card, caption }: { clips: Clip[]; slots: PlanSlot[]; card: StyleCard | null; caption: CaptionLook }): Tip[] {
  const tips: Tip[] = [];
  const len = (c: Clip) => Math.round(c.end_s - c.start_s);

  if (!clips.length) {
    tips.push({ area: "Clip picks", icon: IconScissors, ok: false, text: "No clips yet. Speak a brief and let the AI pick 3 to 5 moments.", target: "brief", action: "Write a brief" });
  } else {
    const low = [...clips].sort((a, b) => (a.score || 0) - (b.score || 0))[0];
    const avg = Math.round(clips.reduce((a, c) => a + (c.score || 0), 0) / clips.length);
    tips.push(
      (low.score || 0) < 75
        ? { area: "Clip picks", icon: IconScissors, ok: false, text: `"${low.title}" scores ${low.score}. Ask for a sharper hook in your brief, or swap it out.`, target: "brief", action: "Refine brief" }
        : { area: "Clip picks", icon: IconScissors, ok: true, text: `Strong set: average score ${avg} across ${clips.length} clips.` },
    );
    const long = clips.filter((c) => len(c) > 45);
    const short = clips.filter((c) => len(c) < 15);
    tips.push(
      long.length || short.length
        ? { area: "Length and pacing", icon: IconCut, ok: false, text: long.length ? `${long.length} clip${long.length > 1 ? "s run" : " runs"} over 45 s. Trim to hook plus payoff; 20 to 45 s holds watch time best.` : `${short.length} clip${short.length > 1 ? "s are" : " is"} under 15 s. Add the payoff line so it lands.`, target: "maker", action: "Open editor" }
        : { area: "Length and pacing", icon: IconCut, ok: true, text: "Every clip sits in the 15 to 45 s sweet spot." },
    );
  }

  const capOk = caption.wordsPerLine <= 3 && caption.fontSize >= 70;
  tips.push({
    area: "Captions and framing",
    icon: IconTypography,
    ok: capOk,
    text: capOk
      ? "Captions are big and short. Two speakers on screen? Try Split framing so both faces stay in shot."
      : `Use ${caption.wordsPerLine > 3 ? "2 to 3 words per line" : "a larger caption size"} so captions read on a phone without pausing.`,
    target: "maker",
    action: capOk ? "Try Split" : "Edit captions",
  });

  if (!card) {
    tips.push({ area: "Brand voice", icon: IconMessage2, ok: false, text: "Set up a style card so copy and clip picks sound like your brand.", target: "stylecard", action: "Set up" });
  } else {
    const rules = card.rules.filter((r) => r.active);
    tips.push(
      rules.length
        ? { area: "Brand voice", icon: IconMessage2, ok: true, text: `${rules.length} learned rule${rules.length > 1 ? "s" : ""} on style card v${card.version}. Latest: "${rules[rules.length - 1].text}".` }
        : { area: "Brand voice", icon: IconMessage2, ok: false, text: "No rules learned yet. Next time you fix the copy, keep “Make this a rule” ticked.", target: "maker", action: "Write copy" },
    );
  }

  const today = ymd(new Date());
  const week = ymd(new Date(Date.now() + 7 * 864e5));
  const next7 = slots.filter((s) => s.day >= today && s.day <= week);
  const reels = next7.filter((s) => s.platform === "reels").length;
  tips.push(
    next7.length >= 4
      ? { area: "Posting cadence", icon: IconCalendarStats, ok: true, text: `${next7.length} posts in the next 7 days (${reels} Reels, ${next7.length - reels} Shorts). Post Reels around 7:30 pm, Shorts around 1 pm.` }
      : { area: "Posting cadence", icon: IconCalendarStats, ok: false, text: next7.length ? `Only ${next7.length} post${next7.length > 1 ? "s" : ""} this week. Aim for 4 or more to stay in the feed.` : "Nothing scheduled. Plan the next 7 days from your best clips.", target: "calendar", action: "Open calendar" },
  );

  const logged = clips.filter((c) => c.outcome);
  const great = clips.filter((c) => c.outcome === "great");
  tips.push(
    great.length
      ? { area: "Results", icon: IconChartBar, ok: true, text: `"${great[0].title}" did great (${len(great[0])} s). Your next "Find clips" run now favours clips like it.` }
      : { area: "Results", icon: IconChartBar, ok: false, text: logged.length ? "No winners logged yet. Keep marking posts Great, OK or Poor; the AI learns what works." : "After posting, open the day in the calendar and mark how it did. The AI uses it for future picks.", target: "calendar", action: "Log results" },
  );
  return tips;
}

export default function SuggestionsPanel(props: { clips: Clip[]; slots: PlanSlot[]; card: StyleCard | null; caption: CaptionLook }) {
  const [open, setOpen] = useState(false);
  const tips = buildTips(props);
  const todo = tips.filter((t) => !t.ok).length;

  function go(id?: string) {
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-press fixed right-5 bottom-5 z-30 inline-flex items-center gap-2 rounded-full bg-ink py-3 pr-5 pl-4 font-semibold text-white shadow-[0_18px_40px_-16px_rgba(11,47,46,.8)] hover:bg-teal-900"
      >
        <IconBulb size={20} stroke={1.8} className="text-marigold" aria-hidden="true" />
        Suggestions
        {todo > 0 && <span className="rounded-full bg-marigold px-2 py-0.5 text-xs font-bold text-ink">{todo}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Suggestions" className="animate-pop surface fixed right-5 bottom-20 z-30 flex max-h-[72vh] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <h2 className="text-lg font-semibold">Suggestions</h2>
              <p className="text-xs text-stone-600">{tips.length - todo} of {tips.length} areas on track</p>
            </div>
            <button aria-label="Close suggestions" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-stone-500 hover:bg-ink/5">
              <IconX size={18} />
            </button>
          </div>
          <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${((tips.length - todo) / tips.length) * 100}%` }} />
          </div>
          <ul className="mt-3 space-y-2 overflow-y-auto px-3 pb-4">
            {tips.map((t) => (
              <li key={t.area} className="flex gap-3 rounded-[18px] px-3 py-3 hover:bg-white/70">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${t.ok ? "bg-teal-50 text-teal-700" : "bg-marigold-soft text-marigold-deep"}`}>
                  <t.icon size={19} stroke={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {t.area}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.ok ? "bg-teal-50 text-teal-800" : "bg-marigold-soft text-marigold-deep"}`}>{t.ok ? "On track" : "Try this"}</span>
                  </p>
                  <p className="mt-1 text-sm text-stone-700">{t.text}</p>
                  {t.target && t.action && (
                    <button onClick={() => go(t.target)} className="mt-1.5 text-xs font-semibold text-teal-800 underline underline-offset-2">
                      {t.action}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
