import { NextResponse } from "next/server";
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

// API routes call this so only signed-in users can spend our API credits.
export async function requireUser(): Promise<NextResponse | null> {
  if (DEMO_MODE || !SUPABASE_READY) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  return null;
}
