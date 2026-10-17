import { connection } from "next/server";

import { createGitHubClient } from "@/lib/github/client";
import { loadRoadmapConfig } from "@/lib/roadmap/config";
import { handleProjectsRequest } from "@/lib/roadmap/http";

/**
 * `GET /api/projects` — status for every tracked repository.
 * `GET /api/projects?repo=owner/name` — status for a single tracked repository.
 *
 * This file is intentionally thin: everything testable lives in
 * `@/lib/roadmap/http`. Here we only opt out of prerendering and wire the real
 * configuration and GitHub client in.
 */
export async function GET(request: Request): Promise<Response> {
  // The response depends on request data and a rate-limited upstream, so it must
  // be rendered per request. With Cache Components enabled, `export const
  // dynamic` no longer exists; `connection()` is the supported way to opt in.
  await connection();

  return handleProjectsRequest(request, {
    loadConfig: loadRoadmapConfig,
    createClient: (config) =>
      createGitHubClient({
        token: config.token,
        baseUrl: config.apiBaseUrl ?? undefined,
      }),
  });
}
