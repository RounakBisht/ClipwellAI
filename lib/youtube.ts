// Shared YouTube helpers (client + server).
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
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
export function parsePastedTranscript(raw: string): { words: [string, number, number][]; segments: [string, number, number][]; duration: number } {
  const toSec = (t: string) => t.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
  const cues: { start: number; text: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s*(.*)$/);
    if (m) cues.push({ start: toSec(m[1]), text: m[2].trim() });
    else if (line.trim() && cues.length) cues[cues.length - 1].text += (cues[cues.length - 1].text ? " " : "") + line.trim();
  }
  const clean = cues.filter((c) => c.text && !/^\d+ (seconds?|minutes?)$/i.test(c.text));
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
