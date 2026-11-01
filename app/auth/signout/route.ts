import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";

export async function POST(request: Request) {
  if (DEMO_MODE || !SUPABASE_READY) return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  const supabase = await createClient();
  // Sign out this browser only, not every device.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
