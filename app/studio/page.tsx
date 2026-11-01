export const dynamic = "force-dynamic";

import StudioHeader from "@/components/StudioHeader";
import NewProject from "@/components/NewProject";
import ProjectList from "@/components/ProjectList";


export default function StudioPage() {
  return (
    <main className="min-h-[100dvh] overflow-x-clip">
      <StudioHeader />
      <h1 className="sr-only">ClipwellAI Studio</h1>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        <NewProject />
        <ProjectList />
      </div>

    </main>
  );
}
