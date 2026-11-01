import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-4xl font-bold text-ink">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-stone-600">The link may be old or mistyped.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-press rounded-full bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800">
          Back home
        </Link>
        <Link href="/studio" className="btn-press rounded-full bg-teal-700/12 px-6 py-3 font-semibold text-teal-800 hover:bg-teal-700/20">
          Open the studio
        </Link>
      </div>
    </main>
  );
}
