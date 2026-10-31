import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { claudeJson, ClaudeError, VOICE_NOTE } from "@/lib/claude";
import { languageLine, SHAPE, styleBlock, SYSTEM, type StyleInput } from "@/lib/copy-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// Applies a spoken edit to the copy. If asked, also turns the edit into a lasting brand rule.
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await req.json()) as {
    platform: "shorts" | "reels";
    language: string;
    content: Record<string, unknown>;
    instruction: string;
    makeRule: boolean;
    style: StyleInput;
  };
  const platform = body.platform === "reels" ? "reels" : "shorts";
  const user = `${VOICE_NOTE}

${styleBlock(body.style)}

${languageLine(body.language)}

Current ${platform === "shorts" ? "YouTube Shorts" : "Instagram Reels"} copy:
${JSON.stringify(body.content, null, 2)}

The team's edit (dictated): "${body.instruction}"

1. Rewrite the copy to apply the edit. Keep everything the edit doesn't touch.
2. ${
    body.makeRule
      ? `Turn the edit into ONE short, general brand rule (<= 10 words, imperative, not specific to this clip), and say which platform it applies to: "all", "shorts" or "reels". Example: edit "too salesy, drop the emojis" on Reels -> {"text": "No emojis; avoid salesy phrasing", "platform": "reels"}.`
      : `Set "rule" to null.`
  }

Return exactly: {"content": ${SHAPE[platform]}, "rule": ${body.makeRule ? '{"text": "...", "platform": "all"}' : "null"}}`;
  try {
    const out = await claudeJson<{ content: Record<string, unknown>; rule: { text: string; platform: string } | null }>(SYSTEM, user, 1000);
    const rule =
      body.makeRule && out.rule?.text
        ? { text: String(out.rule.text).slice(0, 120), platform: ["all", "shorts", "reels"].includes(out.rule.platform) ? out.rule.platform : "all" }
        : null;
    return NextResponse.json({ content: out.content, rule });
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
