import "server-only";

import {
  parseRepositorySlug,
  sameRepository,
  type RepositorySlug,
} from "@/lib/repository-slug";

import { ConfigurationError } from "./errors";

/**
 * Server-only configuration. Everything is read from the environment so that no
 * repository, token, or policy is baked into the (public) source tree.
 */
export interface RoadmapConfig {
  /** Personal access token, or `null` for anonymous, rate-limited access. */
  readonly token: string | null;
  /** API root, or `null` to use the default GitHub.com endpoint. */
  readonly apiBaseUrl: string | null;
  /** Allowlist of repositories this API is permitted to report on. */
  readonly trackedRepositories: readonly RepositorySlug[];
  /** Whether private repositories may be exposed through the public API. */
  readonly includePrivateRepositories: boolean;
}

const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off"]);

/** Parses a permissive boolean flag, falling back when unset or unrecognized. */
export function parseBoolean(
  value: string | undefined | null,
  fallback = false,
): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized) || normalized === "") {
    return false;
  }

  return fallback;
}

/**
 * Parses the `owner/name,owner/name` allowlist.
 *
 * Invalid entries fail loudly (rather than being skipped) so a typo surfaces
 * immediately instead of silently shrinking the roadmap. The offending value is
 * never echoed, so this is safe to log.
 */
export function parseTrackedRepositories(
  raw: string | undefined | null,
): RepositorySlug[] {
  if (!raw) {
    return [];
  }

  const repositories: RepositorySlug[] = [];

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();

    if (trimmed === "") {
      continue;
    }

    const slug = parseRepositorySlug(trimmed);

    if (!slug) {
      throw new ConfigurationError(
        "GITHUB_TRACKED_REPOS contains an entry that is not a valid owner/name slug",
      );
    }

    if (repositories.some((existing) => sameRepository(existing, slug))) {
      continue;
    }

    repositories.push(slug);
  }

  return repositories;
}

function normalizeToken(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

const ALLOWED_API_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Parses the GitHub API root, so GitHub Enterprise (or a local mock) can be
 * targeted without touching code. Only `http`/`https` are accepted.
 */
export function parseApiBaseUrl(value: string | undefined | null): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new ConfigurationError("GITHUB_API_BASE_URL is not a valid URL");
  }

  if (!ALLOWED_API_PROTOCOLS.has(url.protocol)) {
    throw new ConfigurationError(
      "GITHUB_API_BASE_URL must use the http or https protocol",
    );
  }

  return url.href;
}

/** Loads and validates the roadmap configuration from the environment. */
export function loadRoadmapConfig(
  env: Record<string, string | undefined> = process.env,
): RoadmapConfig {
  return {
    token: normalizeToken(env.GITHUB_TOKEN),
    apiBaseUrl: parseApiBaseUrl(env.GITHUB_API_BASE_URL),
    trackedRepositories: parseTrackedRepositories(env.GITHUB_TRACKED_REPOS),
    includePrivateRepositories: parseBoolean(env.GITHUB_INCLUDE_PRIVATE),
  };
}
