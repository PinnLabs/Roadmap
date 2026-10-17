import "server-only";

import { GitHubError } from "@/lib/github/errors";
import type {
  GitHubClient,
  GitHubCommit,
  GitHubRelease,
  GitHubRepository,
} from "@/lib/github/types";
import type { RepositorySlug } from "@/lib/repository-slug";

import type {
  ProjectCommit,
  ProjectRelease,
  ProjectRepository,
  ProjectStatus,
} from "./types";

/** Injecting the clock keeps `fetchedAt` deterministic in tests. */
type Clock = () => Date;

/** Outcome for a single repository, so one failure cannot blank the roadmap. */
export type ProjectStatusResult =
  | {
      readonly ok: true;
      readonly repository: RepositorySlug;
      readonly status: ProjectStatus;
    }
  | {
      readonly ok: false;
      readonly repository: RepositorySlug;
      readonly error: GitHubError;
    };

function toProjectRepository(repository: GitHubRepository): ProjectRepository {
  // Explicit field list: this is the boundary that decides what is public.
  return {
    owner: repository.owner,
    name: repository.name,
    fullName: repository.fullName,
    description: repository.description,
    url: repository.url,
    homepage: repository.homepage,
    visibility: repository.visibility,
    defaultBranch: repository.defaultBranch,
    archived: repository.archived,
    stars: repository.stars,
    forks: repository.forks,
    createdAt: repository.createdAt,
    pushedAt: repository.pushedAt,
  };
}

function toProjectRelease(release: GitHubRelease): ProjectRelease {
  return {
    tag: release.tag,
    name: release.name,
    url: release.url,
    prerelease: release.prerelease,
    publishedAt: release.publishedAt,
  };
}

function toProjectCommit(commit: GitHubCommit): ProjectCommit {
  return {
    sha: commit.sha,
    message: commit.message,
    url: commit.url,
    authorLogin: commit.authorLogin,
    committedAt: commit.committedAt,
  };
}

function toGitHubError(reason: unknown): GitHubError {
  return reason instanceof GitHubError
    ? reason
    : new GitHubError("Unexpected failure while reading from GitHub", {
        code: "upstream",
        cause: reason,
      });
}

/**
 * Assembles a single project's status.
 *
 * Every GitHub call is issued concurrently: the result is only as slow as the
 * slowest request, and the caller is already async.
 */
export async function getProjectStatus(
  client: GitHubClient,
  slug: RepositorySlug,
  now: Clock = () => new Date(),
): Promise<ProjectStatus> {
  const [repository, openIssues, openPullRequests, latestRelease, latestCommit] =
    await Promise.all([
      client.getRepository(slug),
      client.countOpenIssues(slug),
      client.countOpenPullRequests(slug),
      client.getLatestRelease(slug),
      client.getLatestCommit(slug),
    ]);

  return {
    repository: toProjectRepository(repository),
    issues: { open: openIssues },
    pullRequests: { open: openPullRequests },
    latestRelease: latestRelease ? toProjectRelease(latestRelease) : null,
    latestCommit: latestCommit ? toProjectCommit(latestCommit) : null,
    fetchedAt: now().toISOString(),
  };
}

/**
 * Resolves several repositories concurrently, preserving request order and
 * reporting per-repository failures instead of rejecting the whole batch.
 */
export async function getProjectStatuses(
  client: GitHubClient,
  slugs: readonly RepositorySlug[],
  now: Clock = () => new Date(),
): Promise<ProjectStatusResult[]> {
  const outcomes = await Promise.allSettled(
    slugs.map((slug) => getProjectStatus(client, slug, now)),
  );

  return outcomes.map((outcome, index) => {
    const repository = slugs[index];

    return outcome.status === "fulfilled"
      ? { ok: true, repository, status: outcome.value }
      : { ok: false, repository, error: toGitHubError(outcome.reason) };
  });
}
