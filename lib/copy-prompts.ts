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

// ---- Reply hygiene: AI replies are normalised to the exact shape the UI renders ----
const str = (x: unknown, max = 2000) => (typeof x === "string" ? x : x == null ? "" : String(x)).trim().slice(0, max);
export function hashtagList(h: unknown): string[] {
  const raw = Array.isArray(h) ? h.map((x) => str(x, 60)) : str(h, 600).split(/[\s,]+/);
  return raw
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .slice(0, 12);
}

// Returns null when the reply has no usable main text.
export function normalizeCopy(platform: "shorts" | "reels", raw: unknown): Record<string, unknown> | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (platform === "reels") {
    const caption = str(o.caption);
    if (!caption) return null;
    return { caption, hashtags: hashtagList(o.hashtags), coverText: str(o.coverText, 80) };
  }
  const title = str(o.title, 200);
  if (!title) return null;
  return { title, description: str(o.description), hashtags: hashtagList(o.hashtags) };
}

export const COPY_SCHEMA: Record<string, object> = {
  shorts: {
    type: "object",
    properties: { title: { type: "string" }, description: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
    required: ["title", "description", "hashtags"],
  },
  reels: {
    type: "object",
    properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, coverText: { type: "string" } },
    required: ["caption", "hashtags", "coverText"],
  },
};

// Bad or oversized request bodies get a clear 400 instead of a crash.
export async function readJson<T>(req: Request, maxBytes = 1_000_000): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text || text.length > maxBytes) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
