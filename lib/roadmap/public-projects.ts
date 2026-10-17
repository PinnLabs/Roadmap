import "server-only";

import { cacheLife } from "next/cache";

import { createGitHubClient } from "@/lib/github/client";

import { loadRoadmapConfig } from "./config";
import { getProjectStatuses } from "./status";
import type { ProjectStatus } from "./types";

export interface PublicProjects {
  readonly projects: readonly ProjectStatus[];
  /** Number of tracked repositories that could not be loaded. */
  readonly failed: number;
}

/**
 * Status snapshots for the tracked **public** repositories, for server
 * rendering. Private repositories are always excluded here, regardless of
 * `GITHUB_INCLUDE_PRIVATE`, because this feeds the public landing page.
 *
 * Cached for minutes so page views never fan out to the GitHub API.
 */
export async function getPublicProjects(): Promise<PublicProjects> {
  "use cache";
  cacheLife("minutes");

  try {
    const config = loadRoadmapConfig();
    const client = createGitHubClient({
      token: config.token,
      baseUrl: config.apiBaseUrl ?? undefined,
    });
    const results = await getProjectStatuses(client, config.trackedRepositories);

    const projects: ProjectStatus[] = [];
    let failed = 0;

    for (const result of results) {
      if (!result.ok) {
        failed += 1;
      } else if (result.status.repository.visibility === "public") {
        projects.push(result.status);
      }
    }

    return { projects, failed };
  } catch {
    return { projects: [], failed: 0 };
  }
}
