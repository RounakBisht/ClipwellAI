import { NextResponse } from "next/server";

// Public visitor counter for the homepage pill. Each browser is counted once (the pill remembers it in localStorage).
// The count lives in Abacus (free counting API, no key). Calling it from our server means ad blockers can't hide the
// pill and visitors' IPs aren't shared with a third party.
export const dynamic = "force-dynamic";

const BASE = process.env.VISITOR_COUNTER_BASE || "https://abacus.jasoncameron.dev";
const COUNTER = "clipwellai.vercel.app/visitors";
// Only the live site adds to the count; previews and local runs just read it.
const COUNTS = process.env.VERCEL_ENV === "production" || process.env.VISITOR_COUNTER_TEST === "1";

async function read(op: "hit" | "get") {
  try {
    const res = await fetch(`${BASE}/${op}/${COUNTER}`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (res.status === 404) return NextResponse.json({ value: 0 }, { headers: { "cache-control": "no-store" } });
    const json = (await res.json().catch(() => ({}))) as { value?: unknown };
    const value = Number(json.value);
    if (!res.ok || !Number.isFinite(value)) throw new Error(String(res.status));
    return NextResponse.json({ value }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Counter unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}

export async function GET() {
  return read("get");
}

export async function POST() {
  return read(COUNTS ? "hit" : "get");
}
