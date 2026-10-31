export const dynamic = "force-dynamic";

import StudioHeader from "@/components/StudioHeader";
import ProjectView from "@/components/ProjectView";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen">
      <StudioHeader />
      <ProjectView id={id} />
    </main>
  );
}
