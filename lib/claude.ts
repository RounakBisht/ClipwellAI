// Server-only helper for Claude. Tries the configured model first, then falls back if a model name isn't available.
const MODELS = [process.env.CLAUDE_MODEL, "claude-sonnet-5-5", "claude-sonnet-4-5", "claude-3-5-haiku-latest"].filter(
  (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i,
);

export class ClaudeError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeError("ANTHROPIC_API_KEY is not set in Vercel.", 500);
  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (res.ok) {
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (json.content || []).map((c) => c.text || "").join("");
    }
    const body = await res.text();
    lastErr = `${res.status} ${body.slice(0, 300)}`;
    // Unknown model name: try the next one. Anything else: stop.
    if (!(res.status === 404 || /model/i.test(body))) break;
  }
  throw new ClaudeError(`Claude request failed: ${lastErr}`);
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in reply");
  return JSON.parse(text.slice(start, end + 1));
}

// Asks for JSON and retries once if the reply doesn't parse.
export async function claudeJson<T>(system: string, user: string, maxTokens = 2000): Promise<T> {
  let text = await callClaude(system, user, maxTokens);
  try {
    return extractJson(text) as T;
  } catch {
    text = await callClaude(system, `${user}\n\nYour previous reply was not valid JSON. Reply with ONLY the JSON object, nothing else.`, maxTokens);
    return extractJson(text) as T;
  }
}

export const VOICE_NOTE =
  "Inputs from the user were dictated by voice (Wispr Flow). Ignore filler words (uh, um, like, basically) and follow self-corrections: in 'keep it fun, no wait, practical', the user wants practical.";
