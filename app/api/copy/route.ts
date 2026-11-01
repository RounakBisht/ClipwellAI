import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { claudeJson, ClaudeError } from "@/lib/claude";
import { COPY_SCHEMA, languageLine, normalizeCopy, readJson, SHAPE, styleBlock, SYSTEM, type StyleInput } from "@/lib/copy-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Writes first-draft copy for one platform from the clip's own words.
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = await readJson<{
    platform: "shorts" | "reels";
    language: string;
    clip: { title: string; hook: string; reason: string; text: string };
    style: StyleInput;
  }>(req, 200_000);
  if (!body?.clip) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  body.style = body.style || {};
  const platform = body.platform === "reels" ? "reels" : "shorts";
  const user = `${styleBlock(body.style)}

${languageLine(body.language)}

The clip (what is actually said):
"""
${String(body.clip.text || "").slice(0, 4000)}
"""
Working title: ${String(body.clip.title || "").slice(0, 200)}
On-screen hook: ${String(body.clip.hook || "").slice(0, 200)}
Why this clip was picked: ${String(body.clip.reason || "").slice(0, 600)}

Write ${platform === "shorts" ? "YouTube Shorts" : "Instagram Reels"} copy for this clip. Only claim what the clip says.
Return exactly: ${SHAPE[platform]}`;
  try {
    const content = normalizeCopy(platform, await claudeJson<Record<string, unknown>>(SYSTEM, user, 900, COPY_SCHEMA[platform]));
    if (!content) return NextResponse.json({ error: "The AI sent back empty copy. Please try again." }, { status: 502 });
    return NextResponse.json({ content });
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
