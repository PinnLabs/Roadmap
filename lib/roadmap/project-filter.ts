import type { ProjectStatus } from "./types";

/** Sentinel for the default, unfiltered project selection. */
export const ALL_PROJECTS = "all";

export interface ProjectFilter {
  /** `ALL_PROJECTS`, or a repository `fullName` (case-insensitive). */
  readonly project: string;
  /** Free-text query matched against name, description, release and commit. */
  readonly query: string;
}

export interface ProjectSummary {
  readonly repositories: number;
  readonly openIssues: number;
  readonly openPullRequests: number;
  readonly stars: number;
  readonly forks: number;
}

/** Resolves a requested project against the known ones, falling back to all. */
export function resolveProject(
  requested: string | null | undefined,
  projects: readonly ProjectStatus[],
): string {
  if (!requested) {
    return ALL_PROJECTS;
  }

  const match = projects.find(
    (project) =>
      project.repository.fullName.toLowerCase() === requested.trim().toLowerCase(),
  );

  return match ? match.repository.fullName : ALL_PROJECTS;
}

function haystack(project: ProjectStatus): string {
  return [
    project.repository.fullName,
    project.repository.description,
    project.latestRelease?.tag,
    project.latestRelease?.name,
    project.latestCommit?.message,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

export function filterProjects(
  projects: readonly ProjectStatus[],
  filter: ProjectFilter,
): ProjectStatus[] {
  const selected = filter.project.toLowerCase();
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean);

  return projects.filter((project) => {
    if (
      selected !== ALL_PROJECTS &&
      project.repository.fullName.toLowerCase() !== selected
    ) {
      return false;
    }

    const text = haystack(project);
    return terms.every((term) => text.includes(term));
  });
}

export function summarizeProjects(projects: readonly ProjectStatus[]): ProjectSummary {
  return projects.reduce<ProjectSummary>(
    (summary, project) => ({
      repositories: summary.repositories + 1,
      openIssues: summary.openIssues + project.issues.open,
      openPullRequests: summary.openPullRequests + project.pullRequests.open,
      stars: summary.stars + project.repository.stars,
      forks: summary.forks + project.repository.forks,
    }),
    { repositories: 0, openIssues: 0, openPullRequests: 0, stars: 0, forks: 0 },
  );
}
