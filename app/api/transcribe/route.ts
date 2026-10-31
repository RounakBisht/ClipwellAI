import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 60;

// A Hinglish prompt nudges Whisper to write Hindi words in Roman script.
const HINGLISH_PROMPT =
  "Haan toh aaj hum baat karenge business, marketing aur growth ke baare mein. Yeh bahut important hai, samjhe?";

// Receives one audio chunk (under 4 MB) and returns words and segments with absolute times.
export async function POST(req: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY is not set in Vercel." }, { status: 500 });

  const form = await req.formData();
  const file = form.get("file");
  const offset = Number(form.get("offset") || 0);
  const lang = String(form.get("lang") || "auto");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No audio received." }, { status: 400 });

  const fd = new FormData();
  fd.append("file", file, "chunk.mp3");
  fd.append("model", "whisper-large-v3-turbo");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  fd.append("timestamp_granularities[]", "segment");
  fd.append("temperature", "0");
  if (lang === "en") fd.append("language", "en");
  if (lang === "hi") fd.append("language", "hi");
  if (lang === "hinglish") fd.append("prompt", HINGLISH_PROMPT);

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const detail = res ? await res.text() : "no response";
    return NextResponse.json({ error: `Transcription failed (${res?.status}).`, detail: detail.slice(0, 500) }, { status: 502 });
  }

  const json = (await res.json()) as {
    language?: string;
    words?: { word: string; start: number; end: number }[];
    segments?: { text: string; start: number; end: number }[];
  };
  const r2 = (n: number) => Math.round((n + offset) * 100) / 100;
  const words = (json.words || []).map((w) => [w.word.trim(), r2(w.start), r2(w.end)]).filter((w) => w[0]);
  const segments = (json.segments || []).map((s) => [s.text.trim(), r2(s.start), r2(s.end)]).filter((s) => s[0]);
  return NextResponse.json({ words, segments, language: json.language || null });
}
