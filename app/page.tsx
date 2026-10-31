import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";
import Logo, { LogoMark } from "@/components/Logo";
import { APP_NAME, DEMO_MODE, SUPABASE_READY } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; code?: string; error_description?: string }>;
}) {
  const sp = await searchParams;
  // If Supabase fell back to the Site URL, the code lands here: finish sign-in on the callback route.
  if (sp.code) redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}`);
  let signedIn = false;
  if (!DEMO_MODE && SUPABASE_READY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }
  const error = sp.error;
  const reason = sp.reason || sp.error_description;

  const steps = [
    { n: "1", kicker: "Upload karo", title: "Drop in a long video", body: "A podcast, workshop or founder talk, up to 45 minutes. It never leaves your laptop." },
    { n: "2", kicker: "Bolo, brief do", title: "Speak your brief", body: "Tell it what you want with Wispr. Get 3 to 5 clips, each with a reason it was picked." },
    { n: "3", kicker: "Export & post", title: "Captioned 9:16 MP4s", body: "Download Shorts and Reels with burned-in captions and copy written in your brand's voice." },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <span className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm text-stone-600 ring-1 ring-sand sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" />
          Built by voice with Wispr Flow
        </span>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-8 pb-20 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-marigold-soft px-3 py-1 text-sm font-semibold text-marigold-deep">
            Clip karo, post karo
          </p>
          <h1 className="animate-rise mt-5 text-5xl leading-[1.02] font-extrabold text-ink sm:text-6xl" style={{ animationDelay: "80ms" }}>
            Long videos in.
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">On-brand</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-4 rounded-full bg-marigold/45" aria-hidden="true" />
            </span>{" "}
            Reels out.
          </h1>
          <p className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-stone-700" style={{ animationDelay: "160ms" }}>
            Clipping tools treat every brand the same. {APP_NAME} turns your podcasts into Shorts and Reels, and learns how your brand talks, ek edit at a time.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "240ms" }}>
            {signedIn ? (
              <a
                href="/studio"
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,118,110,.8)] hover:bg-teal-800"
              >
                Open your studio
              </a>
            ) : (
              <SignInButton />
            )}
            <a href="#how" className="btn-press rounded-xl px-4 py-3 font-medium text-teal-800 hover:bg-teal-50">
              See how it works
            </a>
          </div>
          {error && (
            <p className="mt-4 max-w-xl text-sm text-red-700">
              Sign-in didn&apos;t complete. Please try again.
              {reason && <span className="mt-1 block text-xs text-red-600">Reason: {reason}</span>}
            </p>
          )}
          <p className="animate-rise mt-8 flex items-center gap-2 text-sm text-stone-600" style={{ animationDelay: "320ms" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.2" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Your footage stays on your laptop. Only the audio is sent for transcription.
          </p>
        </div>

        <HeroVisual />
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-3xl font-extrabold text-ink">Teen steps. That&apos;s it.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="animate-rise rounded-3xl bg-white p-7 shadow-[0_1px_0_#f1e4cc,0_12px_30px_-18px_rgba(23,38,42,.25)] ring-1 ring-sand"
              style={{ animationDelay: `${120 * i}ms` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-marigold font-display text-lg font-extrabold text-ink">{s.n}</div>
              <p className="mt-5 text-sm font-semibold text-teal-700">{s.kicker}</p>
              <h3 className="mt-1 text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-stone-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid items-center gap-10 rounded-[2rem] bg-teal-800 p-8 text-teal-50 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-marigold">The part other tools skip</p>
            <h2 className="mt-2 text-4xl font-extrabold text-white">A style card that learns from every edit</h2>
            <p className="mt-4 text-lg text-teal-100">
              Say &ldquo;too salesy, drop the emojis&rdquo; once. Mark it as a rule, and every future clip follows it. Tell it what worked, and it picks better next time.
            </p>
          </div>
          <StyleCardTeaser />
        </div>
      </section>

      <footer className="border-t border-sand px-6 py-8 text-center text-sm text-stone-500">
        <span className="inline-flex items-start gap-2 text-left sm:items-center">
          <LogoMark size={18} /> Made by Rounak &amp; Kartik for the Product Space × Wispr Flow AI Hackathon
        </span>
      </footer>
    </main>
  );
}

function HeroVisual() {
  const bars = Array.from({ length: 28 }, (_, i) => 0.35 + ((i * 37) % 11) / 16);
  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[520px]" aria-hidden="true">
      <div className="animate-rise absolute top-2 left-0 w-[78%] rounded-3xl bg-white p-4 shadow-[0_20px_50px_-25px_rgba(23,38,42,.45)] ring-1 ring-sand" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span className="font-semibold text-ink">Founder podcast · ep 12</span>
          <span>42:10</span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-[3px] rounded-2xl bg-cream px-3 py-2">
          {bars.map((h, i) => (
            <span
              key={i}
              className="animate-bar w-full rounded-full bg-teal-600/70"
              style={{ height: `${h * 100}%`, animationDelay: `${(i % 7) * 120}ms` }}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {["0:42", "11:05", "27:30"].map((t) => (
            <span key={t} className="whitespace-nowrap rounded-full bg-marigold-soft px-2 py-0.5 text-xs font-semibold text-marigold-deep">
              clip @ {t}
            </span>
          ))}
        </div>
      </div>

      {[
        { left: "6%", top: "44%", r: "-6deg", delay: "300ms", words: ["Subah", "ki", "dhoop"], tag: "Hook in 3 sec" },
        { left: "36%", top: "38%", r: "2deg", delay: "420ms", words: ["Phone", "baad", "mein"], tag: "Score 92" },
        { left: "66%", top: "46%", r: "7deg", delay: "540ms", words: ["Try", "this", "today"], tag: "Brand voice" },
      ].map((c, i) => (
        <div key={i} className="animate-rise absolute w-[30%]" style={{ left: c.left, top: c.top, animationDelay: c.delay }}>
          <div className="animate-bob" style={{ ["--r" as string]: c.r, animationDelay: `${i * 600}ms` } as React.CSSProperties}>
            <div className="relative aspect-[9/16] overflow-hidden rounded-[1.4rem] bg-gradient-to-b from-teal-700 to-ink shadow-[0_24px_40px_-20px_rgba(23,38,42,.6)] ring-4 ring-white">
              <div className="absolute inset-x-3 top-3 h-1 rounded-full bg-white/25">
                <div className="h-full w-1/2 rounded-full bg-white/80" />
              </div>
              <div className="absolute top-[38%] left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-marigold/30" />
              <p className="absolute inset-x-2 bottom-[22%] text-center font-display text-[15px] leading-tight font-extrabold text-white">
                {c.words.map((w, j) => (
                  <span key={j}>
                    <span className="animate-hl" style={{ animationDelay: `${j * 0.8}s` }}>
                      {w}
                    </span>{" "}
                  </span>
                ))}
              </p>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-teal-800">
                {c.tag}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StyleCardTeaser() {
  const rows = [
    ["Tone", "Practical, warm, no hype"],
    ["Hook style", "Open with a question"],
    ["Emojis", "None on Shorts"],
    ["Language", "Hinglish (Roman)"],
  ];
  return (
    <div className="rounded-3xl bg-white p-6 text-ink shadow-xl" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold">Style card</span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">v1 → v2</span>
      </div>
      <dl className="mt-4 divide-y divide-sand text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-stone-500">{k}</dt>
            <dd className={`font-medium ${k === "Emojis" ? "rounded-md bg-marigold-soft px-1.5 text-marigold-deep" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="animate-pop mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white" style={{ animationDelay: "900ms" }}>
        <span className="h-2 w-2 rounded-full bg-marigold" /> Learned: no emojis on Shorts
      </div>
    </div>
  );
}
