import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (DEMO_MODE || !URL_ || !KEY) return response;

  const supabase = createServerClient(URL_, KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/studio")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/studio/:path*", "/auth/:path*"],
};
