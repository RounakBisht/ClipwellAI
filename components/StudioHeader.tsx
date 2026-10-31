import Link from "next/link";
import { DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

export default async function StudioHeader() {
  let email: string | null = null;
  const demo = DEMO_MODE || !SUPABASE_READY;
  if (!demo) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }
  return (
    <header className="sticky top-0 z-20 bg-white/55 shadow-[inset_0_-1px_0_rgba(255,255,255,.7),0_10px_30px_-24px_rgba(16,60,56,.45)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" aria-label="ClipwellAI home" className="shrink-0">
          <Logo size={28} suffix="Studio" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm whitespace-nowrap text-stone-600 sm:gap-4">
          <Link href="/studio" className="font-medium text-teal-800 hover:text-teal-900">Projects</Link>
          {demo ? (
            <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-amber-800 sm:inline">Demo mode · data stays in this browser</span>
          ) : (
            <>
              <span className="hidden max-w-[220px] truncate md:inline" title={email || ""}>{email}</span>
              <form action="/auth/signout" method="post">
                <button className="rounded-full bg-ink/5 px-3 py-1.5 whitespace-nowrap hover:bg-ink/10">Sign out</button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
