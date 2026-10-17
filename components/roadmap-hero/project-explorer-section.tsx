import { getPublicProjects } from "@/lib/roadmap/public-projects";

import { ProjectExplorer } from "./project-explorer";

export async function ProjectExplorerSection() {
  const { projects, failed } = await getPublicProjects();

  return <ProjectExplorer projects={projects} failed={failed} />;
}
