import "server-only";

import { cacheLife } from "next/cache";

import { createGitHubClient } from "@/lib/github/client";

import { loadRoadmapConfig } from "./config";

export interface OrganizationSummary {
  readonly login: string;
  readonly url: string;
  readonly followers: number;
}

/**
 * Follower count for the configured organization, cached for an hour so the
 * header never spends the (rate-limited) GitHub budget on every request.
 *
 * Returns `null` on any failure: a missing badge is better than a broken header.
 */
export async function getOrganizationSummary(): Promise<OrganizationSummary | null> {
  "use cache";
  cacheLife("hours");

  try {
    const config = loadRoadmapConfig();

    if (!config.organization) {
      return null;
    }

    const organization = await createGitHubClient({
      token: config.token,
      baseUrl: config.apiBaseUrl ?? undefined,
    }).getOrganization(config.organization);

    return {
      login: organization.login || config.organization,
      url: organization.url || `https://github.com/${config.organization}`,
      followers: organization.followers,
    };
  } catch {
    return null;
  }
}
