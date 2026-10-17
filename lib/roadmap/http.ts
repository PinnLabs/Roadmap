import { GitHubError, type GitHubErrorCode } from "@/lib/github/errors";
import type { GitHubClient } from "@/lib/github/types";
import {
  formatRepositorySlug,
  parseRepositorySlug,
  sameRepository,
  type RepositorySlug,
} from "@/lib/repository-slug";

import type { RoadmapConfig } from "./config";
import { ConfigurationError } from "./errors";
import { getProjectStatus, getProjectStatuses } from "./status";
import type { ProjectStatus } from "./types";

/**
 * Framework-agnostic request handler for the projects endpoint.
 *
 * It takes its collaborators as dependencies, so it can be unit-tested without
 * a Next.js runtime, a network, or environment variables. `app/api/projects/route.ts`
 * is the thin adapter that wires the real configuration and GitHub client in.
 */
export interface ProjectsHandlerDependencies {
  /** Loads server configuration. Expected to throw `ConfigurationError`. */
  readonly loadConfig: () => RoadmapConfig;
  /** Builds the GitHub client for the given configuration. */
  readonly createClient: (config: RoadmapConfig) => GitHubClient;
  /** Injectable clock, for deterministic `fetchedAt` values. */
  readonly now?: () => Date;
}

type Clock = () => Date;

interface ErrorMapping {
  readonly status: number;
  readonly code: string;
}

const ERROR_MAPPINGS: Record<GitHubErrorCode, ErrorMapping> = {
  not_found: { status: 404, code: "not_found" },
  rate_limited: { status: 429, code: "rate_limited" },
  unauthorized: { status: 502, code: "upstream_unauthorized" },
  timeout: { status: 504, code: "upstream_timeout" },
  network: { status: 502, code: "upstream_unavailable" },
  upstream: { status: 502, code: "upstream_error" },
};

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("x-content-type-options", "nosniff");

  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

/**
 * Translates a failure into a response. Only a coarse, stable code is returned:
 * upstream messages, tokens, and stack traces never reach the client.
 */
function errorResponse(error: unknown): Response {
  if (error instanceof GitHubError) {
    const mapping = ERROR_MAPPINGS[error.code];
    const headers = new Headers();

    if (mapping.code === "rate_limited" && error.retryAfterSeconds !== null) {
      headers.set("retry-after", String(error.retryAfterSeconds));
    }

    return json({ error: mapping.code }, mapping.status, headers);
  }

  return json({ error: "internal_error" }, 500);
}

function findTracked(
  slug: RepositorySlug,
  tracked: readonly RepositorySlug[],
): RepositorySlug | null {
  return tracked.find((candidate) => sameRepository(candidate, slug)) ?? null;
}

function isVisible(status: ProjectStatus, config: RoadmapConfig): boolean {
  return (
    config.includePrivateRepositories || status.repository.visibility === "public"
  );
}

async function singleRepositoryResponse(
  requested: string,
  config: RoadmapConfig,
  deps: ProjectsHandlerDependencies,
  now: Clock,
): Promise<Response> {
  const parsed = parseRepositorySlug(requested.trim());

  if (!parsed) {
    return json({ error: "invalid_repository" }, 400);
  }

  // The allowlist is the security boundary: anything not listed is reported as
  // absent, so the endpoint cannot be used to probe arbitrary repositories.
  const slug = findTracked(parsed, config.trackedRepositories);

  if (!slug) {
    return json({ error: "not_found" }, 404);
  }

  const status = await getProjectStatus(deps.createClient(config), slug, now);

  if (!isVisible(status, config)) {
    return json({ error: "not_found" }, 404);
  }

  return json({ project: status }, 200);
}

async function collectionResponse(
  config: RoadmapConfig,
  deps: ProjectsHandlerDependencies,
  now: Clock,
): Promise<Response> {
  const results = await getProjectStatuses(
    deps.createClient(config),
    config.trackedRepositories,
    now,
  );

  const projects: ProjectStatus[] = [];
  const errors: Array<{ repository: string; error: GitHubErrorCode }> = [];

  for (const result of results) {
    if (!result.ok) {
      errors.push({
        repository: formatRepositorySlug(result.repository),
        error: result.error.code,
      });
      continue;
    }

    if (isVisible(result.status, config)) {
      projects.push(result.status);
    }
  }

  return json({ projects, errors }, 200);
}

export async function handleProjectsRequest(
  request: Request,
  deps: ProjectsHandlerDependencies,
): Promise<Response> {
  const now = deps.now ?? (() => new Date());

  let config: RoadmapConfig;

  try {
    config = deps.loadConfig();
  } catch (error) {
    return error instanceof ConfigurationError
      ? json({ error: "server_misconfigured" }, 500)
      : json({ error: "internal_error" }, 500);
  }

  try {
    const requested = new URL(request.url).searchParams.get("repo");

    return requested !== null
      ? await singleRepositoryResponse(requested, config, deps, now)
      : await collectionResponse(config, deps, now);
  } catch (error) {
    return errorResponse(error);
  }
}
