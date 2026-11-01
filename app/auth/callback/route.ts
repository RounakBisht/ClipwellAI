import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";

// Google sends the user back here; we swap the code for a session and open the studio.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  if (DEMO_MODE || !SUPABASE_READY) return NextResponse.redirect(`${origin}/studio`);
  const code = searchParams.get("code");
  const upstream = searchParams.get("error_description") || searchParams.get("error");
  if (upstream) {
    return NextResponse.redirect(`${origin}/?error=signin&reason=${encodeURIComponent(upstream)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?error=signin&reason=${encodeURIComponent("No sign-in code came back from Google.")}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/?error=signin&reason=${encodeURIComponent(error.message)}`);
  }
  return NextResponse.redirect(`${origin}/studio`);
}
