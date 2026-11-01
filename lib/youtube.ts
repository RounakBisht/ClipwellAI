// Shared YouTube helpers (client + server).
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    const ok = (v: string | null | undefined) => (v && /^[\w-]{11}$/.test(v) ? v : null);
    if (host === "youtu.be") return ok(u.pathname.slice(1, 12));
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return ok(v.slice(0, 11));
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export const YT_PREFIX = "youtube:";
export function projectYoutubeId(sourceName?: string | null): string | null {
  return sourceName && sourceName.startsWith(YT_PREFIX) ? sourceName.slice(YT_PREFIX.length) : null;
}

// Parse text copied from YouTube's "Show transcript" panel:
//   0:00\nhello everyone\n0:04\ntoday we...   or   0:00 hello everyone
const DURATION = /^(\d+ (hours?|minutes?|seconds?),? ?)+$/i;
export function parsePastedTranscript(raw: string): { words: [string, number, number][]; segments: [string, number, number][]; duration: number } {
  const toSec = (t: string) => t.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
  const cues: { start: number; text: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s*(.*)$/);
    // A timestamp earlier than the last one is part of the text, not a new cue.
    if (m && (!cues.length || toSec(m[1]) >= cues[cues.length - 1].start)) cues.push({ start: toSec(m[1]), text: m[2].trim() });
    // YouTube's screen-reader line ("4 seconds", "1 minute, 2 seconds") right after a timestamp isn't speech.
    else if (cues.length && !cues[cues.length - 1].text && DURATION.test(line.trim())) continue;
    else if (line.trim() && cues.length) cues[cues.length - 1].text += (cues[cues.length - 1].text ? " " : "") + line.trim();
  }
  const clean = cues.filter((c) => c.text && !DURATION.test(c.text));
  const segments: [string, number, number][] = clean.map((c, i) => [c.text, c.start, Math.max(c.start + 0.5, clean[i + 1]?.start ?? c.start + 4)]);
  const words: [string, number, number][] = [];
  for (const [text, s, e] of segments) {
    const ws = text.split(/\s+/);
    const total = ws.reduce((a, w) => a + w.length + 1, 0);
    let t = s;
    for (const w of ws) {
      const d = ((e - s) * (w.length + 1)) / total;
      words.push([w, t, t + d]);
      t += d;
    }
  }
  return { words, segments, duration: segments.length ? segments[segments.length - 1][2] : 0 };
}
