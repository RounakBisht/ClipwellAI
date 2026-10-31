// Shared prompt pieces for writing and editing Shorts and Reels copy.
export interface StyleInput {
  brand?: string;
  sells?: string | null;
  audience?: string | null;
  tone?: string;
  hookStyle?: string;
  emojisHashtags?: string;
  rules?: string[];
}

export function languageLine(lang: string): string {
  if (lang === "hi") return "Write in Hindi using Devanagari script.";
  if (lang === "hinglish")
    return "Write in natural Hinglish: Hindi and English mixed the way Indian creators talk, all in Roman (Latin) script. Never use Devanagari.";
  return "Write in clear, simple Indian English.";
}

export function styleBlock(s: StyleInput): string {
  return `Brand: ${s.brand || "unknown"}${s.sells ? `, sells ${s.sells}` : ""}${s.audience ? `, audience: ${s.audience}` : ""}
Tone: ${s.tone || "not set"}
Hook style: ${s.hookStyle || "not set"}
Emojis and hashtags: ${s.emojisHashtags || "use sparingly"}
Brand rules you MUST follow (learned from the team's past edits): ${s.rules?.length ? s.rules.map((r) => `\n- ${r}`).join("") : "none yet"}`;
}

export const SHAPE: Record<string, string> = {
  shorts: `{"title": "<= 90 chars, YouTube Shorts title, the hook first", "description": "2-3 short lines", "hashtags": ["#tag", "..."]}`,
  reels: `{"caption": "Instagram Reels caption: first line is the hook, then 2-4 short lines, end with a clear call to action", "hashtags": ["#tag", "..."], "coverText": "<= 6 words for the Reel cover"}`,
};

export const SYSTEM =
  "You are the social media copywriter for an Indian D2C brand. You write YouTube Shorts and Instagram Reels copy that sounds like the brand, not like AI. You follow the brand's rules exactly. Reply with JSON only.";
