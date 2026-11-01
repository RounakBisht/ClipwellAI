import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { claudeJson, ClaudeError, VOICE_NOTE } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

type Seg = [string, number, number];
interface Picked {
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  score: number;
}

const MAX_LEN = 75;

const CLIPS_SCHEMA = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number" },
          end: { type: "number" },
          title: { type: "string" },
          hook: { type: "string" },
          reason: { type: "string" },
          score: { type: "number" },
        },
        required: ["start", "end", "title", "hook", "reason", "score"],
      },
    },
  },
  required: ["clips"],
};

// Snaps a pick to whole transcript segments so clips start and end on complete sentences.
function snap(p: Picked, segs: Seg[], duration: number, MIN_LEN: number): Picked | null {
  if (!segs.length) return null;
  let si = 0;
  for (let i = 0; i < segs.length; i++) if (segs[i][1] <= p.start + 0.75) si = i;
  let ei = si;
  for (let i = si; i < segs.length; i++) {
    if (segs[i][2] <= p.end + 1.5) ei = i;
    else break;
  }
  let start = segs[si][1];
  let end = segs[ei][2];
  while (end - start < MIN_LEN && ei < segs.length - 1) end = segs[++ei][2];
  while (end - start > MAX_LEN && ei > si) end = segs[--ei][2];
  start = Math.max(0, start);
  end = Math.min(duration, end);
  if (end - start < Math.min(8, MIN_LEN)) return null;
  return { ...p, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 };
}

export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await req.json()) as {
    brief: string;
    count: number;
    duration: number;
    segments: Seg[];
    brand?: { name?: string; sells?: string | null; audience?: string | null };
    style?: { tone?: string; hookStyle?: string; rules?: string[]; learnings?: string[] };
  };
  const duration = Number(body.duration) || (body.segments.length ? body.segments[body.segments.length - 1][2] : 0);
  // Short videos can't hold several 20-60 s clips: ask for fewer, shorter ones instead of an impossible request.
  const short = duration < 150;
  const minLen = short ? 6 : 15;
  const fits = Math.max(1, Math.floor(duration / (short ? 12 : 25)));
  const count = Math.min(Math.min(5, Math.max(1, Number(body.count) || 4)), fits);
  const lenRule = short ? `run 8 to ${Math.max(10, Math.min(45, Math.round(duration / count)))} seconds` : "run 20 to 60 seconds";
  const lines = body.segments.map(([t, s, e]) => `[${s.toFixed(1)}-${e.toFixed(1)}] ${t}`).join("\n");

  const system =
    "You are a senior short-form video editor for Indian D2C brands. You pick moments from long videos that work as standalone YouTube Shorts and Instagram Reels, and you explain each pick in plain words. Reply with JSON only.";
  const user = `${VOICE_NOTE}

BRIEF (dictated): ${body.brief || "No brief given: pick the most engaging, useful moments."}

Brand: ${body.brand?.name || "unknown"}${body.brand?.sells ? `, sells ${body.brand.sells}` : ""}${body.brand?.audience ? `, audience: ${body.brand.audience}` : ""}
Brand tone: ${body.style?.tone || "not set"}
Hook style: ${body.style?.hookStyle || "not set"}
Active brand rules: ${(body.style?.rules || []).join("; ") || "none"}
What has worked before: ${(body.style?.learnings || []).join("; ") || "nothing recorded yet"}

Pick ${count} clip${count > 1 ? "s" : ""} from the transcript below (the video is ${Math.round(duration)} seconds long). Each clip must:
- ${lenRule},
- start at the beginning of a sentence with a strong first 3 seconds, and end on a complete thought,
- make sense on its own without the rest of the video,
- not overlap other clips,
- fit the brief.
If fewer good clips exist, return the best ones you can find (at least 1). Never reply with questions or prose; always use the JSON shape below.

Transcript lines are [start-end seconds] text:
${lines}

Return exactly:
{"clips": [{"start": <seconds>, "end": <seconds>, "title": "<= 60 chars, the clip's title for Shorts", "hook": "<= 8 words of on-screen hook text", "reason": "1-2 sentences on why this works for the brief and audience", "score": <0-100 predicted performance>}]}`;

  try {
    const out = await claudeJson<{ clips: Picked[] }>(system, user, 2500, CLIPS_SCHEMA);
    const segs = body.segments;
    const picked = (out.clips || [])
      .map((c) => snap({ ...c, start: Number(c.start), end: Number(c.end), score: Math.round(Number(c.score) || 0) }, segs, duration, minLen))
      .filter((c): c is Picked => Boolean(c))
      .sort((a, b) => a.start - b.start)
      .filter((c, i, arr) => i === 0 || c.start >= arr[i - 1].end - 1)
      .sort((a, b) => b.score - a.score);
    if (!picked.length) return NextResponse.json({ error: "No usable clips came back. Try a broader brief." }, { status: 422 });
    return NextResponse.json({ clips: picked });
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
