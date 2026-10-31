// Word-by-word captions: the same timing drives the live 9:16 preview and the ASS file burned into the MP4.
import type { Word } from "@/lib/types";

export interface CaptionStyle {
  fontSize: number; // in pixels on a 720×1280 frame
  textColor: string; // #RRGGBB
  highlightColor: string; // colour of the word being spoken
  position: "lower" | "middle";
  wordsPerLine: number;
  uppercase: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 76,
  textColor: "#FFFFFF",
  highlightColor: "#FFC23D",
  position: "lower",
  wordsPerLine: 3,
  uppercase: false,
};

export const CAPTION_FONT_FAMILY = "Baloo 2 ExtraBold"; // internal name of /fonts/Baloo2-ExtraBold.ttf

// Words whose midpoint falls inside the clip, re-timed so the clip starts at 0.
export function clipWords(words: Word[], start: number, end: number): Word[] {
  return words
    .filter(([, s, e]) => (s + e) / 2 >= start && (s + e) / 2 <= end)
    .map(([t, s, e]) => [t, Math.max(0, s - start), Math.min(end - start, e - start)] as Word);
}

// Groups words into short phrases, breaking early at sentence ends and long pauses.
export function phrases(words: Word[], perLine: number): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?।]$/.test(w[0]);
    const pause = next ? next[1] - w[2] > 0.6 : true;
    if (cur.length >= perLine || endsSentence || pause) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

// Which phrase and word are on screen at time t (seconds from clip start).
export function captionAt(groups: Word[][], t: number): { words: Word[]; active: number } | null {
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const first = group[0][1];
    const nextStart = groups[g + 1]?.[0][1] ?? Infinity;
    const last = Math.min(group[group.length - 1][2] + 0.35, nextStart);
    if (t >= first && t < last) {
      let active = 0;
      for (let i = 0; i < group.length; i++) if (t >= group[i][1]) active = i;
      return { words: group, active };
    }
  }
  return null;
}

function assColor(hex: string): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase();
}
function assTime(t: number): string {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}
function clean(t: string, upper: boolean): string {
  const s = t.replace(/[{}\\]/g, "");
  return upper ? s.toUpperCase() : s;
}

// Builds an ASS subtitle file for a 720×1280 frame with the current word highlighted.
export function buildAss(words: Word[], style: CaptionStyle): string {
  const align = style.position === "middle" ? 5 : 2;
  const marginV = style.position === "middle" ? 0 : 300;
  const tc = assColor(style.textColor);
  const hc = assColor(style.highlightColor);
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 720",
    "PlayResY: 1280",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${CAPTION_FONT_FAMILY},${style.fontSize},${tc},${tc},&H00000000&,&H80000000&,0,0,0,0,100,100,0,0,1,5,2,${align},60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events: string[] = [];
  const groups = phrases(words, style.wordsPerLine);
  groups.forEach((group, g) => {
    const nextStart = groups[g + 1]?.[0][1] ?? Infinity;
    group.forEach((w, i) => {
      const start = w[1];
      const end = i < group.length - 1 ? group[i + 1][1] : Math.min(w[2] + 0.35, nextStart);
      if (end <= start) return;
      const text = group
        .map((x, j) => (j === i ? `{\\c${hc}\\fscx108\\fscy108}${clean(x[0], style.uppercase)}{\\c${tc}\\fscx100\\fscy100}` : clean(x[0], style.uppercase)))
        .join(" ");
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${text}`);
    });
  });
  return [...header, ...events, ""].join("\n");
}

// Plain SRT, offered alongside the MP4 as a fallback.
export function buildSrt(words: Word[], perLine: number): string {
  return phrases(words, perLine)
    .map((g, i) => `${i + 1}\n${srtTime(g[0][1])} --> ${srtTime(g[g.length - 1][2])}\n${g.map((w) => w[0]).join(" ")}\n`)
    .join("\n");
}
function srtTime(t: number): string {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
