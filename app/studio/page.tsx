export const dynamic = "force-dynamic";

import StudioHeader from "@/components/StudioHeader";
import NewProject from "@/components/NewProject";
import ProjectList from "@/components/ProjectList";

export default function StudioPage() {
  return (
    <main className="min-h-screen">
      <StudioHeader />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NewProject />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <ProjectList />
          <div className="rounded-3xl bg-white p-6 shadow-[0_1px_0_#f1e4cc,0_12px_30px_-20px_rgba(23,38,42,.25)] ring-1 ring-sand">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Style card</h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">Coming in M3</span>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              Your brand&apos;s tone, hook style, caption look, emojis and hashtags, and language. It learns from every edit you mark as a rule.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
