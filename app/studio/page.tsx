export const dynamic = "force-dynamic";

import { APP_NAME, DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage() {
  let email: string | null = null;
  if (!DEMO_MODE && SUPABASE_READY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  const sections = [
    { title: "Style card", body: "Your brand's tone, hook style, caption look, emojis and hashtags, and language. Arrives in M3.", tag: "M3" },
    { title: "New project", body: "Upload a long video and get a transcript with word timings. Arrives in M1.", tag: "M1" },
    { title: "Clips", body: "Clips with reasons, 9:16 previews, MP4 export and Shorts and Reels copy. Arrives in M2, M4 and M5.", tag: "M2 · M4 · M5" },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">{APP_NAME} Studio</span>
          <div className="flex items-center gap-4 text-sm text-stone-600">
            {DEMO_MODE || !SUPABASE_READY ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Demo mode</span>
            ) : (
              <>
                <span>{email}</span>
                <form action="/auth/signout" method="post">
                  <button className="rounded-lg px-3 py-1.5 ring-1 ring-stone-200 hover:bg-stone-50">Sign out</button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-6 py-8 md:grid-cols-3">
        {sections.map((s) => (
          <div key={s.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{s.title}</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{s.tag}</span>
            </div>
            <p className="mt-2 text-sm text-stone-600">{s.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
