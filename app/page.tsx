import { redirect } from "next/navigation";
import HeroVideo from "@/components/HeroVideo";
import DemoVideo from "@/components/DemoVideo";
import SignInButton from "@/components/SignInButton";
import Logo, { LogoMark } from "@/components/Logo";
import { APP_NAME, DEMO_MODE, PRODUCT_SPACE_URL, SUPABASE_READY, WISPR_URL } from "@/lib/config";
import { IconTrophy, IconBrandYoutube, IconBrandLinkedin, IconChartArrowsVertical, IconBrain, IconCalendarEvent, IconCut, IconDots, IconHeartFilled, IconLock, IconMessageCircle, IconMicrophone, IconSend, IconSparkles, IconTypography } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; code?: string; error_description?: string }>;
}) {
  const sp = await searchParams;
  // If Supabase fell back to the Site URL, the code lands here: finish sign-in on the callback route.
  if (sp.code && !DEMO_MODE && SUPABASE_READY) redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}`);
  let signedIn = false;
  if (!DEMO_MODE && SUPABASE_READY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }
  const error = sp.error;

  const steps = [
    { icon: IconBrandYoutube, kicker: "Upload karo", title: "Paste a link or drop a video", body: "A YouTube podcast, workshop or founder talk, however long it runs." },
    { icon: IconMicrophone, kicker: "Bolo, brief do", title: "Speak your brief", body: "Tell it what you want with Wispr. Get clips with a reason for each pick." },
    { icon: IconCut, kicker: "Export & post", title: "Captioned 9:16 MP4s", body: "Shorts and Reels with burned-in captions and copy in your brand's voice." },
  ];
  // The six things a repurposing studio with brand memory has to do
  const features = [
    { icon: IconBrandYoutube, label: "Long videos and podcasts in" },
    { icon: IconSparkles, label: "Clip picks, each with a reason" },
    { icon: IconTypography, label: "Captions and copy per platform" },
    { icon: IconBrain, label: "Brand voice that learns your edits" },
    { icon: IconCalendarEvent, label: "Content calendar" },
    { icon: IconChartArrowsVertical, label: "Learns from what performed" },
  ];

  return (
    <div className="min-h-[100dvh] overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6 py-6">
        <Logo />
        <div className="hidden flex-col items-end gap-2 text-right text-sm sm:flex">
          <a href={WISPR_URL} target="_blank" rel="noreferrer" className="chip-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium text-ink hover:text-teal-800">
            <IconMicrophone size={15} stroke={2} className="text-teal-700" aria-hidden="true" />
            Built by voice with <span className="underline decoration-marigold decoration-2 underline-offset-4">Wispr Flow</span>
          </a>
          <a href={PRODUCT_SPACE_URL} target="_blank" rel="noreferrer" className="chip-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium text-ink hover:text-teal-800">
            <IconTrophy size={15} stroke={2} className="text-marigold-deep" aria-hidden="true" />
            Built at <span className="underline decoration-marigold decoration-2 underline-offset-4">Product Space</span> Hackathon
          </a>
        </div>
      </header>
      <main>

      <section className="mx-auto max-w-6xl px-6 pt-10 text-center">
        <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-marigold-soft px-3.5 py-1 text-sm font-semibold text-marigold-deep">
          <span className="pulse-ring h-2 w-2 rounded-full bg-marigold" aria-hidden="true" />
          Content repurposing studio with brand memory
        </p>
        <h1 className="animate-rise mx-auto mt-6 max-w-4xl text-5xl leading-[1.04] font-bold text-ink sm:text-7xl" style={{ animationDelay: "80ms" }}>
          Long videos in.{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span className="relative z-10 text-teal-700">On-brand</span>
            <span className="absolute inset-x-1 bottom-1 z-0 h-3 rounded-full bg-marigold/50" aria-hidden="true" />
          </span>{" "}
          Reels out.
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-700 sm:text-xl" style={{ animationDelay: "160ms" }}>
          Paste a YouTube link / Podcast or drop a Long Video. {APP_NAME} picks the moments worth posting, tells you why, and learns your brand voice from every edit and every result.
        </p>
        <div className="animate-rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
          {signedIn ? (
            <a
              href="/studio"
              className="btn-press inline-flex items-center gap-2 rounded-full bg-teal-700 px-7 py-3.5 font-semibold text-white shadow-[0_14px_30px_-14px_rgba(15,118,110,.9)] hover:bg-teal-800"
            >
              Open your studio
            </a>
          ) : (
            <SignInButton />
          )}
          <a href="#how" className="btn-press rounded-full bg-teal-700/12 px-6 py-3.5 font-semibold text-teal-800 shadow-[inset_0_0_0_1px_rgba(15,118,110,.18)] hover:bg-teal-700/20">
            See how it works
          </a>
        </div>
        <p className="mt-5 text-xs text-stone-600 sm:hidden">
          Built by voice with{" "}
          <a href={WISPR_URL} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline underline-offset-2">Wispr Flow</a>
          {" "}at{" "}
          <a href={PRODUCT_SPACE_URL} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline underline-offset-2">Product Space</a> Hackathon
        </p>
        {error && !DEMO_MODE && SUPABASE_READY && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-red-700">
            Sign-in didn&apos;t complete. Please try again.
          </p>
        )}

        <HeroClips />

        <p className="mt-12 inline-flex items-center gap-2 text-sm text-stone-600">
          <IconLock size={15} stroke={2} className="text-teal-700" aria-hidden="true" />
          Your footage stays on your laptop. Only the audio is sent for transcription.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-4xl px-6">
        <ul className="reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.label} className="chip-soft inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink">
              <f.icon size={17} stroke={1.8} className="text-teal-700" aria-hidden="true" />
              {f.label}
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className="mx-auto max-w-5xl scroll-mt-10 px-6 pt-24 pb-20 text-center">
        <h2 className="reveal text-4xl font-bold text-ink sm:text-5xl">3 steps. That&apos;s it.</h2>
        <ol className="relative mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          <span className="absolute top-8 right-[16%] left-[16%] hidden border-t-2 border-dashed border-teal-700/25 md:block" aria-hidden="true" />
          {steps.map((s, i) => (
            <li key={s.title} className="reveal relative flex flex-col items-center">
              <span className="lift relative z-10 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-marigold to-[#f08c00] text-white shadow-[0_16px_30px_-14px_rgba(201,122,0,.8)]">
                <s.icon size={28} stroke={1.8} aria-hidden="true" />
              </span>
              <span className="mt-5 text-sm font-semibold text-teal-700">
                {i + 1}. {s.kicker}
              </span>
              <h3 className="mt-1 text-xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 max-w-[18rem] text-stone-600">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="reveal surface mx-auto mt-16 aspect-[4/5] w-full max-w-[480px] overflow-hidden p-2">
          <DemoVideo src="/demo/demo.mp4" poster="/demo/demo.jpg" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="reveal relative grid items-center gap-10 overflow-hidden rounded-[40px] bg-gradient-to-br from-teal-800 via-teal-900 to-[#0b2f2e] p-8 text-teal-50 shadow-[0_40px_80px_-40px_rgba(11,47,46,.8)] sm:p-12 lg:grid-cols-2">
          <span className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-marigold/25 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-sm font-semibold text-[#ffb84d]">The part other tools skip</p>
            <h2 className="mt-2 text-4xl font-bold text-white sm:text-5xl">A style card that learns from every edit</h2>
            <p className="mt-4 text-lg text-teal-100">
              Say &ldquo;too salesy, drop the emojis&rdquo; once. Mark it as a rule, and every future clip follows it. Tell it what worked, and it picks better next time.
            </p>
          </div>
          <StyleCardTeaser />
        </div>
      </section>

      </main>
      <footer className="px-6 pb-10 text-center text-sm text-stone-600">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <LogoMark size={18} /> Made by{" "}
          <a href="https://www.linkedin.com/in/rounak-bisht-/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-800 underline underline-offset-2">
            <IconBrandLinkedin size={15} aria-hidden="true" />Rounak
          </a>{" "}
          &amp;{" "}
          <a href="https://www.linkedin.com/in/kartik-manral-b08383249/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-800 underline underline-offset-2">
            <IconBrandLinkedin size={15} aria-hidden="true" />Kartik
          </a>{" "}
          ·
          <span>
            Built at{" "}
            <a href={PRODUCT_SPACE_URL} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline underline-offset-2">
              Product Space
            </a>{" "}
            Hackathon with{" "}
            <a href={WISPR_URL} target="_blank" rel="noreferrer" className="font-semibold text-teal-800 underline underline-offset-2">
              Wispr Flow
            </a>
          </span>
        </span>
      </footer>
    </div>
  );
}

// Three real exported clips, fanned symmetrically. Muted loops; hover straightens and lifts.
function HeroClips() {
  const clips = [
    { src: "/hero/clip-a", tag: "Hook in 2 sec", r: "-7deg", y: "28px", z: 1 },
    { src: "/hero/clip-b", tag: "Score 92", r: "0deg", y: "0px", z: 2 },
    { src: "/hero/clip-c", tag: "On-brand copy", r: "7deg", y: "28px", z: 1, post: true },
  ];
  return (
    <div role="group" className="hero-row relative mx-auto mt-14 flex max-w-3xl items-start justify-center" aria-label="Example clips made with ClipwellAI">
      <span className="pointer-events-none absolute top-1/2 left-1/2 hidden h-72 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600/20 blur-3xl sm:block" aria-hidden="true" />
      {clips.map((c, i) => (
        <div
          key={c.src}
          className="hero-phone animate-rise group relative -mx-2 w-[31%] max-w-[230px]"
          style={{ animationDelay: `${300 + i * 120}ms`, zIndex: c.z, marginTop: c.y }}
        >
          <div className="animate-float" style={{ ["--r" as string]: c.r, animationDelay: `${i * 0.7}s` } as React.CSSProperties}>
            <div className="relative aspect-[9/16] overflow-hidden rounded-[30px] bg-ink p-[5px] shadow-[0_34px_60px_-28px_rgba(11,47,46,.75)] transition duration-500 group-hover:scale-[1.04]">
              <HeroVideo className="h-full w-full rounded-[25px] object-cover" src={`${c.src}.mp4`} poster={`${c.src}.jpg`} />
              <span className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-black/60" aria-hidden="true" />
              {"post" in c && <ReelOverlay />}
            </div>
            <span className="chip-soft absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap text-teal-800">
              {c.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Example of how the clip looks once posted: Reels-style action rail and the caption ClipwellAI wrote.
function ReelOverlay() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-[5px] overflow-hidden rounded-[25px] text-left text-white">
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      <div className="absolute right-2 bottom-[22%] flex flex-col items-center gap-2.5 text-[10px] font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        <span className="flex flex-col items-center"><IconHeartFilled size={20} className="text-[#ff3b5c]" aria-hidden="true" />14.3K</span>
        <span className="flex flex-col items-center"><IconMessageCircle size={20} stroke={2} aria-hidden="true" />729</span>
        <span className="flex flex-col items-center"><IconSend size={19} stroke={2} aria-hidden="true" />Share</span>
        <IconDots size={16} aria-hidden="true" />
      </div>
      <div className="absolute right-10 bottom-3 left-8">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marigold text-[9px] font-bold text-ink">R</span>
          rohan.edits
          <span className="rounded-md border border-white/70 px-1.5 text-[9px]">Follow</span>
        </p>
        <p className="mt-1 text-[10px] leading-snug">
          18 mahine cargo ship pe, aur jo dekha woh koi explain nahi kar paaya. Full story Prakhar Gupta podcast pe…
        </p>
        <p className="mt-0.5 text-[10px] font-semibold text-sky-200">#podcastclips #merchantnavy</p>
      </div>
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
    <div className="relative rounded-[28px] bg-white/95 p-6 text-ink shadow-2xl" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">Style card</span>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">v1 → v2</span>
      </div>
      <dl className="mt-4 divide-y divide-ink/8 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-stone-600">{k}</dt>
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
