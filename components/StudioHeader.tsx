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
    <header className="sticky top-0 z-20 border-b border-sand bg-cream/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/studio" aria-label="Studio home">
          <Logo size={28} suffix="Studio" />
        </Link>
        <div className="flex items-center gap-4 text-sm text-stone-600">
          {demo ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Demo mode · data stays in this browser</span>
          ) : (
            <>
              <span>{email}</span>
              <form action="/auth/signout" method="post">
                <button className="rounded-lg px-3 py-1.5 ring-1 ring-sand hover:bg-stone-50">Sign out</button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
