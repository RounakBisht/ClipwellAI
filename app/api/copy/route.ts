import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { claudeJson, ClaudeError } from "@/lib/claude";
import { languageLine, SHAPE, styleBlock, SYSTEM, type StyleInput } from "@/lib/copy-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Writes first-draft copy for one platform from the clip's own words.
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await req.json()) as {
    platform: "shorts" | "reels";
    language: string;
    clip: { title: string; hook: string; reason: string; text: string };
    style: StyleInput;
  };
  const platform = body.platform === "reels" ? "reels" : "shorts";
  const user = `${styleBlock(body.style)}

${languageLine(body.language)}

The clip (what is actually said):
"""
${body.clip.text.slice(0, 4000)}
"""
Working title: ${body.clip.title}
On-screen hook: ${body.clip.hook}
Why this clip was picked: ${body.clip.reason}

Write ${platform === "shorts" ? "YouTube Shorts" : "Instagram Reels"} copy for this clip. Only claim what the clip says.
Return exactly: ${SHAPE[platform]}`;
  try {
    const content = await claudeJson<Record<string, unknown>>(SYSTEM, user, 900);
    return NextResponse.json({ content });
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
