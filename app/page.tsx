import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";
import { APP_NAME, APP_TAGLINE, DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!DEMO_MODE && SUPABASE_READY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/studio");
  }
  const { error } = await searchParams;

  const steps = [
    { n: "1", title: "Upload a long video", body: "A podcast, workshop or founder talk, up to 45 minutes. It never leaves your laptop." },
    { n: "2", title: "Speak your brief", body: "Tell it what you want with Wispr. Get 3–5 clips, each with a reason." },
    { n: "3", title: "Export and refine", body: "Download captioned 9:16 MP4s with Shorts and Reels copy. Every edit teaches your style card." },
  ];

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
        <span className="text-sm text-stone-500">Built by voice with Wispr Flow</span>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 text-center">
        <p className="mb-4 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
          A mini editing studio for D2C brand teams
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{APP_TAGLINE}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-stone-600">
          Clipping tools treat every brand the same. {APP_NAME} learns how yours talks, one edit at a time.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
        {error && <p className="mt-4 text-sm text-red-600">Sign-in didn&apos;t complete. Please try again.</p>}
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
              {s.n}
            </div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-stone-600">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
