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
        </div>
      </div>

    </main>
  );
}
