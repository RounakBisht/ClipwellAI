// YouTube link -> transcript with word timings, read from the video's captions.
// We never download the video itself; MP4 export still needs the file.
import { NextResponse } from "next/server";
import { youtubeId } from "@/lib/youtube";
import { requireUser } from "@/lib/auth-server";
import type { Segment, Word } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Track = { baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string; runs?: { text: string }[] } };
type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string; lengthSeconds?: string; author?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } };
};

const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function viaInnertube(id: string): Promise<PlayerResponse | null> {
  const clients = [
    { name: "ANDROID", version: "20.10.38", ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip", extra: { androidSdkVersion: 34 }, header: "3" },
    { name: "WEB", version: "2.20250101.00.00", ua: WEB_UA, extra: {}, header: "1" },
  ];
  for (const c of clients) {
    try {
      const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": c.ua, "x-youtube-client-name": c.header, "x-youtube-client-version": c.version },
        body: JSON.stringify({ context: { client: { clientName: c.name, clientVersion: c.version, hl: "en", gl: "IN", ...c.extra } }, videoId: id }),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as PlayerResponse;
      if (j.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) return j;
      if (j.videoDetails && !j.captions) return j;
    } catch {
      /* try the next client */
    }
  }
  return null;
}

async function viaWatchPage(id: string): Promise<PlayerResponse | null> {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: { "user-agent": WEB_UA, "accept-language": "en-US,en;q=0.9" } });
    const html = await r.text();
    const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s|<\/script>)/);
    return m ? (JSON.parse(m[1]) as PlayerResponse) : null;
  } catch {
    return null;
  }
}

function pickTrack(tracks: Track[], lang: string): Track {
  const want = lang === "en" ? ["en"] : lang === "auto" ? [] : ["hi", "en"];
  const score = (t: Track) => {
    const i = want.findIndex((w) => t.languageCode.startsWith(w));
    return (i === -1 ? 10 : i) * 2 + (t.kind === "asr" ? 1 : 0);
  };
  return [...tracks].sort((a, b) => score(a) - score(b))[0];
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "");

// Turn caption cues into word timings. json3 ASR tracks carry per-word offsets; manual tracks get words spread across the cue.
function toWords(cues: { start: number; end: number; parts: { text: string; at?: number }[] }[]): Word[] {
  const words: Word[] = [];
  for (const cue of cues) {
    const text = cue.parts.map((p) => p.text).join("");
    if (!text.trim()) continue;
    const timed = cue.parts.filter((p) => p.text.trim() && p.at !== undefined);
    if (timed.length > 1) {
      timed.forEach((p, i) => {
        const s = p.at!;
        const e = i + 1 < timed.length ? timed[i + 1].at! : cue.end;
        for (const w of p.text.trim().split(/\s+/)) words.push([w, s, Math.max(s + 0.05, e)]);
      });
    } else {
      const ws = text.replace(/\n/g, " ").trim().split(/\s+/);
      const total = ws.reduce((a, w) => a + w.length + 1, 0);
      let t = cue.start;
      for (const w of ws) {
        const d = ((cue.end - cue.start) * (w.length + 1)) / total;
        words.push([w, t, t + d]);
        t += d;
      }
    }
  }
  // Rolling ASR cues can overlap; keep time moving forward.
  words.sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < words.length; i++) if (words[i][1] < words[i - 1][2]) words[i - 1][2] = Math.max(words[i - 1][1] + 0.05, words[i][1]);
  return words;
}

function toSegments(words: Word[]): Segment[] {
  const out: Segment[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) out.push([cur.map((w) => w[0]).join(" "), cur[0][1], cur[cur.length - 1][2]]);
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const span = w[2] - cur[0][1];
    if (/[.?!।]$/.test(w[0]) || span > 7 || cur.length >= 18) flush();
  }
  flush();
  return out;
}

async function fetchCues(track: Track) {
  const base = track.baseUrl.replace(/&fmt=[^&]*/, "");
  const r = await fetch(`${base}&fmt=json3`, { headers: { "user-agent": WEB_UA } });
  const body = await r.text();
  if (body.trim().startsWith("{")) {
    const j = JSON.parse(body) as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8: string; tOffsetMs?: number }[] }[] };
    return (j.events || [])
      .filter((e) => e.segs)
      .map((e) => {
        const start = (e.tStartMs || 0) / 1000;
        return {
          start,
          end: start + (e.dDurationMs || 0) / 1000,
          // The first word of a cue has no offset: it starts with the cue.
          parts: e.segs!.map((s, k) => ({ text: s.utf8, at: s.tOffsetMs !== undefined ? start + s.tOffsetMs / 1000 : k === 0 ? start : undefined })),
        };
      });
  }
  // XML fallback (<text start dur>)
  const xml = body.length ? body : await (await fetch(base, { headers: { "user-agent": WEB_UA } })).text();
  return [...xml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[1]) + Number(m[2]),
    parts: [{ text: decode(m[3]) }],
  }));
}

export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const { url, lang = "hinglish" } = (await req.json().catch(() => ({}))) as { url?: string; lang?: string };
  const id = youtubeId(url || "");
  if (!id) return NextResponse.json({ error: "That doesn't look like a YouTube link." }, { status: 400 });

  const pr = (await viaInnertube(id)) || (await viaWatchPage(id));
  if (!pr) return NextResponse.json({ error: "Couldn't reach YouTube from our server. Try again, or upload the video file." }, { status: 502 });
  const status = pr.playabilityStatus?.status;
  if (status && status !== "OK" && !pr.captions)
    return NextResponse.json({ error: `YouTube didn't share this video with our server (${pr.playabilityStatus?.reason || status}). Upload the file instead.` }, { status: 502 });

  const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) return NextResponse.json({ error: "This video has no captions YouTube will share. Upload the file and we'll transcribe it." }, { status: 422 });

  const track = pickTrack(tracks, lang);
  try {
    const words = toWords(await fetchCues(track));
    if (!words.length) throw new Error("empty");
    const duration = Number(pr.videoDetails?.lengthSeconds) || Math.ceil(words[words.length - 1][2]);
    return NextResponse.json({
      id,
      title: pr.videoDetails?.title || `YouTube ${id}`,
      author: pr.videoDetails?.author || "",
      duration_s: duration,
      captionLanguage: track.languageCode + (track.kind === "asr" ? " (auto)" : ""),
      words,
      segments: toSegments(words),
    });
  } catch {
    return NextResponse.json({ error: "YouTube returned empty captions for this video. Upload the file instead." }, { status: 502 });
  }
}
