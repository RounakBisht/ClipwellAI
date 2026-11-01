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

type Block = { type: string; text?: string; input?: unknown };

// When a schema is given, Claude must answer through a tool call, so the reply is always structured JSON.
async function callClaude(system: string, user: string, maxTokens: number, schema?: object): Promise<Block[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeError("ANTHROPIC_API_KEY is not set in Vercel.", 500);
  let lastErr = "";
  for (const model of MODELS) {
    const payload: Record<string, unknown> = { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] };
    if (schema) {
      payload.tools = [{ name: "respond", description: "Return the answer in the requested JSON shape.", input_schema: schema }];
      payload.tool_choice = { type: "tool", name: "respond" };
    }
    const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = (await res.json()) as { content?: Block[] };
      return json.content || [];
    }
    const body = await res.text();
    lastErr = `${res.status} ${body.slice(0, 300)}`;
    // Unknown model name: try the next one. Anything else: stop.
    if (!(res.status === 404 || /model/i.test(body))) break;
  }
  throw new ClaudeError(`Claude request failed: ${lastErr}`);
}

function extractJson(blocks: Block[]): unknown {
  const tool = blocks.find((b) => b.type === "tool_use" && b.input && typeof b.input === "object");
  if (tool && Object.keys(tool.input as object).length) return tool.input;
  const text = blocks.map((b) => b.text || "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no-json");
  return JSON.parse(text.slice(start, end + 1));
}

const ANY_OBJECT = { type: "object", additionalProperties: true };

// Asks for JSON (forced through a tool call) and retries once if the reply still doesn't parse.
export async function claudeJson<T>(system: string, user: string, maxTokens = 2000, schema: object = ANY_OBJECT): Promise<T> {
  try {
    return extractJson(await callClaude(system, user, maxTokens, schema)) as T;
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    try {
      const again = await callClaude(system, `${user}\n\nReply with ONLY the JSON object described above, nothing else.`, maxTokens);
      return extractJson(again) as T;
    } catch (e2) {
      if (e2 instanceof ClaudeError) throw e2;
      throw new ClaudeError("The AI's reply came back in the wrong format. Please try again.", 502);
    }
  }
}

export const VOICE_NOTE =
  "Inputs from the user were dictated by voice (Wispr Flow). Ignore filler words (uh, um, like, basically) and follow self-corrections: in 'keep it fun, no wait, practical', the user wants practical.";
