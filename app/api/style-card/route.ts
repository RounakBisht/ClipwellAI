import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { claudeJson, ClaudeError, VOICE_NOTE } from "@/lib/claude";
import { readJson } from "@/lib/copy-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Builds style card v1 from the brand basics, a tone preset and optional past captions.
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = await readJson<{
    name: string;
    sells: string;
    audience: string;
    tonePreset: string;
    seedCaptions: string;
    language: string;
  }>(req, 50_000);
  if (!body || !String(body.name || "").trim()) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  for (const k of ["name", "sells", "audience", "tonePreset", "language"] as const) body[k] = String(body[k] || "").slice(0, 200);
  const system =
    "You are a brand voice strategist for Indian D2C brands making YouTube Shorts and Instagram Reels. You write short, specific, usable style rules. Reply with JSON only.";
  const user = `${VOICE_NOTE}

Brand: ${body.name}
What they sell: ${body.sells || "not given"}
Audience: ${body.audience || "not given"}
Tone preset they picked: ${body.tonePreset}
Language for captions and copy: ${body.language}
Past captions they liked (may be empty):
"""
${(body.seedCaptions || "").slice(0, 3000)}
"""

Fill in the brand's style card. If past captions are given, infer the style from them; otherwise follow the preset.
Return exactly:
{"tone": "<= 8 words", "hookStyle": "<= 12 words, how the first line of a clip should grab attention", "emojisHashtags": "<= 14 words, e.g. 'Max 1 emoji; 3 hashtags on Reels, 2 on Shorts'", "highlightColor": "#RRGGBB, a bright brand-appropriate colour readable on dark video"}`;
  try {
    const out = await claudeJson<{ tone: string; hookStyle: string; emojisHashtags: string; highlightColor: string }>(system, user, 600);
    const hex = /^#[0-9a-f]{6}$/i.test(out.highlightColor || "") ? out.highlightColor : "#FFC23D";
    const s = (x: unknown, d: string) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 200) : d);
    return NextResponse.json({
      tone: s(out.tone, "Warm, clear and practical"),
      hookStyle: s(out.hookStyle, "Open with a surprising question"),
      emojisHashtags: s(out.emojisHashtags, "Max 1 emoji; 3 hashtags on Reels, 2 on Shorts"),
      highlightColor: hex,
    });
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
