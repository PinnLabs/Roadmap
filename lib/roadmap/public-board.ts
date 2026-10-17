import "server-only";

import { cacheLife } from "next/cache";

import { createGitHubClient } from "@/lib/github/client";
import { formatRepositorySlug } from "@/lib/repository-slug";

import { toRoadmapItems, type RoadmapItem } from "./board";
import { loadRoadmapConfig } from "./config";

/**
 * Roadmap items for the tracked **public** repositories. Private repositories
 * are never read here, regardless of `GITHUB_INCLUDE_PRIVATE`, because this
 * feeds the public landing page.
 *
 * Cached for minutes so page views never fan out to the GitHub API. A
 * repository that fails is skipped rather than blanking the whole board.
 */
export async function getPublicRoadmapItems(): Promise<RoadmapItem[]> {
  "use cache";
  cacheLife("minutes");

  try {
    const config = loadRoadmapConfig();
    const client = createGitHubClient({
      token: config.token,
      baseUrl: config.apiBaseUrl ?? undefined,
    });

    const results = await Promise.allSettled(
      config.trackedRepositories.map(async (slug) => {
        const repository = await client.getRepository(slug);

        if (repository.visibility !== "public") {
          return [];
        }

        return toRoadmapItems(formatRepositorySlug(slug), await client.listIssues(slug));
      }),
    );

    return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  } catch {
    return [];
  }
}
