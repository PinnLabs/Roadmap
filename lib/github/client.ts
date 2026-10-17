import { formatRepositorySlug, type RepositorySlug } from "@/lib/repository-slug";

import { GitHubError, type GitHubErrorCode } from "./errors";
import type {
  GitHubClient,
  GitHubClientOptions,
  GitHubCommit,
  GitHubIssue,
  GitHubOrganization,
  GitHubRelease,
  GitHubRepository,
} from "./types";

const DEFAULT_BASE_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = "pinnlabs-roadmap";
const API_VERSION = "2026-03-10";
const MAX_ERROR_DETAIL_LENGTH = 200;

interface RawRepository {
  id?: unknown;
  name?: unknown;
  full_name?: unknown;
  owner?: { login?: unknown } | null;
  description?: unknown;
  html_url?: unknown;
  homepage?: unknown;
  default_branch?: unknown;
  visibility?: unknown;
  private?: unknown;
  archived?: unknown;
  stargazers_count?: unknown;
  forks_count?: unknown;
  open_issues_count?: unknown;
  pushed_at?: unknown;
  created_at?: unknown;
}

interface RawRelease {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
}

interface RawCommit {
  sha?: unknown;
  html_url?: unknown;
  author?: { login?: unknown } | null;
  commit?: { message?: unknown; committer?: { date?: unknown } | null } | null;
}

interface RawIssue {
  number?: unknown;
  title?: unknown;
  html_url?: unknown;
  state?: unknown;
  labels?: unknown;
  assignees?: unknown;
  pull_request?: { merged_at?: unknown } | null;
  milestone?: {
    title?: unknown;
    due_on?: unknown;
    open_issues?: unknown;
    closed_issues?: unknown;
  } | null;
  comments?: unknown;
  updated_at?: unknown;
  closed_at?: unknown;
}

const DEFAULT_ISSUE_LIMIT = 50;
const MAX_ISSUE_LIMIT = 100;

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((label: unknown) =>
      typeof label === "string"
        ? label
        : typeof label === "object" && label !== null
          ? text((label as { name?: unknown }).name)
          : "",
    )
    .filter((name) => name !== "");
}

function assigneeList(value: unknown): GitHubIssue["assignees"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((user): user is { login?: unknown; avatar_url?: unknown } =>
      typeof user === "object" && user !== null,
    )
    .map((user) => ({ login: text(user.login), avatarUrl: nullableText(user.avatar_url) }))
    .filter((user) => user.login !== "");
}

function toIssue(raw: RawIssue): GitHubIssue {
  const milestone = raw.milestone;

  return {
    number: count(raw.number),
    title: text(raw.title),
    url: text(raw.html_url),
    state: raw.state === "closed" ? "closed" : "open",
    isPullRequest: typeof raw.pull_request === "object" && raw.pull_request !== null,
    mergedAt: nullableText(raw.pull_request?.merged_at),
    labels: labelNames(raw.labels),
    assignees: assigneeList(raw.assignees),
    milestone: milestone
      ? {
          title: text(milestone.title),
          dueOn: nullableText(milestone.due_on),
          openIssues: count(milestone.open_issues),
          closedIssues: count(milestone.closed_issues),
        }
      : null,
    comments: count(raw.comments),
    updatedAt: nullableText(raw.updated_at),
    closedAt: nullableText(raw.closed_at),
  };
}

interface RawOrganization {
  login?: unknown;
  name?: unknown;
  html_url?: unknown;
  avatar_url?: unknown;
  followers?: unknown;
}

interface RawSearchResult {
  total_count?: unknown;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function firstLine(message: string): string {
  const [line = ""] = message.split("\n");
  return line.trim();
}

function resolveVisibility(raw: RawRepository): "public" | "private" {
  if (raw.visibility === "public") {
    return "public";
  }

  if (raw.visibility === "private" || raw.visibility === "internal") {
    return "private";
  }

  return raw.private === false ? "public" : "private";
}

function errorName(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name?: unknown };
    return typeof name === "string" ? name : null;
  }

  return null;
}

function isAbortError(error: unknown): boolean {
  const name = errorName(error);
  return name === "AbortError" || name === "TimeoutError";
}

function collapse(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_ERROR_DETAIL_LENGTH
    ? `${normalized.slice(0, MAX_ERROR_DETAIL_LENGTH)}…`
    : normalized;
}

function redact(message: string, token: string | null): string {
  return token ? message.split(token).join("[redacted]") : message;
}

function classify(status: number, headers: Headers): GitHubErrorCode {
  if (status === 401) {
    return "unauthorized";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 429) {
    return "rate_limited";
  }

  if (status === 403 && headers.get("x-ratelimit-remaining") === "0") {
    return "rate_limited";
  }

  return "upstream";
}

function resolveRetryAfterSeconds(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds);
    }

    const date = Date.parse(retryAfter);

    if (!Number.isNaN(date)) {
      return Math.max(0, Math.ceil((date - Date.now()) / 1000));
    }
  }

  const reset = headers.get("x-ratelimit-reset");

  if (reset) {
    const epochSeconds = Number(reset);

    if (Number.isFinite(epochSeconds)) {
      return Math.max(0, Math.ceil(epochSeconds - Date.now() / 1000));
    }
  }

  return null;
}

async function toResponseError(
  response: Response,
  token: string | null,
): Promise<GitHubError> {
  const status = response.status;
  let detail = "";

  try {
    const body: unknown = await response.json();

    if (typeof body === "object" && body !== null && "message" in body) {
      const { message } = body as { message?: unknown };

      if (typeof message === "string" && message !== "") {
        detail = `: ${collapse(message)}`;
      }
    }
  } catch {
  }

  return new GitHubError(
    redact(`GitHub request failed with status ${status}${detail}`, token),
    {
      code: classify(status, response.headers),
      status,
      retryAfterSeconds: resolveRetryAfterSeconds(response.headers),
    },
  );
}

export function createGitHubClient(
  options: GitHubClientOptions = {},
): GitHubClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = options.token?.trim() ? options.token.trim() : null;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/vnd.github+json");
    headers.set("x-github-api-version", API_VERSION);
    headers.set("user-agent", userAgent);

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    let response: Response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new GitHubError("GitHub request timed out", {
          code: "timeout",
          cause: error,
        });
      }

      throw new GitHubError("Could not reach GitHub", {
        code: "network",
        cause: error,
      });
    }

    if (!response.ok) {
      throw await toResponseError(response, token);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new GitHubError(
        "GitHub returned a response that could not be parsed as JSON",
        { code: "upstream", status: response.status, cause: error },
      );
    }
  }

  const repositoryPath = (slug: RepositorySlug): string =>
    `/repos/${encodeURIComponent(slug.owner)}/${encodeURIComponent(slug.name)}`;

  async function countByType(
    slug: RepositorySlug,
    type: "issue" | "pr",
  ): Promise<number> {
    const query = `repo:${formatRepositorySlug(slug)} type:${type} state:open`;

    try {
      const result = await request<RawSearchResult>(
        `/search/issues?q=${encodeURIComponent(query)}`,
      );

      return count(result.total_count);
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) {
        throw new GitHubError("Repository cannot be searched", {
          code: "not_found",
          status: error.status,
          cause: error,
        });
      }

      throw error;
    }
  }

  return {
    async getOrganization(login) {
      const raw = await request<RawOrganization>(
        `/orgs/${encodeURIComponent(login)}`,
      );

      return {
        login: text(raw.login),
        name: nullableText(raw.name),
        url: text(raw.html_url),
        avatarUrl: nullableText(raw.avatar_url),
        followers: count(raw.followers),
      } satisfies GitHubOrganization;
    },

    async listIssues(slug, limit = DEFAULT_ISSUE_LIMIT) {
      const perPage = Math.min(Math.max(Math.trunc(limit), 1), MAX_ISSUE_LIMIT);
      const raw = await request<RawIssue[]>(
        `${repositoryPath(slug)}/issues?state=all&sort=updated&direction=desc&per_page=${perPage}`,
      );

      return Array.isArray(raw) ? raw.map(toIssue) : [];
    },

    async getRepository(slug) {
      const raw = await request<RawRepository>(repositoryPath(slug));

      return {
        id: count(raw.id),
        owner: text(raw.owner?.login),
        name: text(raw.name),
        fullName: text(raw.full_name),
        description: nullableText(raw.description),
        url: text(raw.html_url),
        homepage: nullableText(raw.homepage),
        defaultBranch: text(raw.default_branch),
        visibility: resolveVisibility(raw),
        archived: raw.archived === true,
        stars: count(raw.stargazers_count),
        forks: count(raw.forks_count),
        openIssues: count(raw.open_issues_count),
        pushedAt: nullableText(raw.pushed_at),
        createdAt: nullableText(raw.created_at),
      } satisfies GitHubRepository;
    },

    countOpenIssues(slug) {
      return countByType(slug, "issue");
    },

    countOpenPullRequests(slug) {
      return countByType(slug, "pr");
    },

    async getLatestRelease(slug) {
      try {
        const raw = await request<RawRelease>(
          `${repositoryPath(slug)}/releases/latest`,
        );

        return {
          tag: text(raw.tag_name),
          name: nullableText(raw.name),
          url: text(raw.html_url),
          prerelease: raw.prerelease === true,
          publishedAt: nullableText(raw.published_at),
        } satisfies GitHubRelease;
      } catch (error) {
        if (error instanceof GitHubError && error.code === "not_found") {
          return null;
        }

        throw error;
      }
    },

    async getLatestCommit(slug) {
      try {
        const raw = await request<RawCommit[]>(
          `${repositoryPath(slug)}/commits?per_page=1`,
        );

        if (!Array.isArray(raw) || raw.length === 0) {
          return null;
        }

        const [latest] = raw;

        return {
          sha: text(latest.sha),
          message: firstLine(text(latest.commit?.message)),
          url: text(latest.html_url),
          authorLogin: nullableText(latest.author?.login),
          committedAt: nullableText(latest.commit?.committer?.date),
        } satisfies GitHubCommit;
      } catch (error) {
        if (
          error instanceof GitHubError &&
          (error.code === "not_found" || error.status === 409)
        ) {
          return null;
        }

        throw error;
      }
    },
  };
}
