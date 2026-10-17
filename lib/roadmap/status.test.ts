import { describe, expect, it } from "vitest";

import { GitHubError } from "../github/errors";
import type { GitHubClient, GitHubCommit, GitHubRelease, GitHubRepository } from "../github/types";
import { sameRepository, type RepositorySlug } from "../repository-slug";
import { getProjectStatus, getProjectStatuses } from "./status";

const slug: RepositorySlug = { owner: "PinnLabs", name: "roadmap" };
const otherSlug: RepositorySlug = { owner: "PinnLabs", name: "PinnStatus" };
const fixedNow = () => new Date("2026-06-01T12:00:00.000Z");

const repository: GitHubRepository = {
  id: 42,
  owner: "PinnLabs",
  name: "roadmap",
  fullName: "PinnLabs/roadmap",
  description: "Public roadmap for PinnLabs projects.",
  url: "https://github.com/PinnLabs/roadmap",
  homepage: null,
  defaultBranch: "main",
  visibility: "public",
  archived: false,
  stars: 12,
  forks: 3,
  openIssues: 5,
  pushedAt: "2026-01-02T03:04:05Z",
  createdAt: "2025-01-01T00:00:00Z",
};

const release: GitHubRelease = {
  tag: "v1.2.0",
  name: "Roadmap 1.2.0",
  url: "https://github.com/PinnLabs/roadmap/releases/tag/v1.2.0",
  prerelease: false,
  publishedAt: "2026-02-01T00:00:00Z",
};

const commit: GitHubCommit = {
  sha: "abc123",
  message: "feat: add project status endpoint",
  url: "https://github.com/PinnLabs/roadmap/commit/abc123",
  authorLogin: "felipecastro",
  committedAt: "2026-03-01T10:00:00Z",
};

function fakeClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    listIssues: async () => [],
    getOrganization: async (login) => ({
      login,
      name: null,
      url: `https://github.com/${login}`,
      avatarUrl: null,
      followers: 0,
    }),
    getRepository: async () => repository,
    countOpenIssues: async () => 5,
    countOpenPullRequests: async () => 2,
    getLatestRelease: async () => release,
    getLatestCommit: async () => commit,
    ...overrides,
  };
}

describe("getProjectStatus", () => {
  it("composes a status DTO from the individual GitHub calls", async () => {
    await expect(getProjectStatus(fakeClient(), slug, fixedNow)).resolves.toEqual({
      repository: {
        owner: "PinnLabs",
        name: "roadmap",
        fullName: "PinnLabs/roadmap",
        description: "Public roadmap for PinnLabs projects.",
        url: "https://github.com/PinnLabs/roadmap",
        homepage: null,
        visibility: "public",
        defaultBranch: "main",
        archived: false,
        stars: 12,
        forks: 3,
        createdAt: "2025-01-01T00:00:00Z",
        pushedAt: "2026-01-02T03:04:05Z",
      },
      issues: { open: 5 },
      pullRequests: { open: 2 },
      latestRelease: release,
      latestCommit: commit,
      fetchedAt: "2026-06-01T12:00:00.000Z",
    });
  });

  it("does not expose GitHub's internal identifier", async () => {
    const status = await getProjectStatus(fakeClient(), slug, fixedNow);

    expect(status.repository).not.toHaveProperty("id");
  });

  it("preserves an absent release and commit", async () => {
    const status = await getProjectStatus(
      fakeClient({ getLatestRelease: async () => null, getLatestCommit: async () => null }),
      slug,
      fixedNow,
    );

    expect(status.latestRelease).toBeNull();
    expect(status.latestCommit).toBeNull();
  });

  it("dispatches every GitHub call concurrently", async () => {
    const calls: string[] = [];
    const client = fakeClient({
      getRepository: async () => {
        calls.push("repository");
        return repository;
      },
      countOpenIssues: async () => {
        calls.push("issues");
        return 5;
      },
      countOpenPullRequests: async () => {
        calls.push("pullRequests");
        return 2;
      },
      getLatestRelease: async () => {
        calls.push("release");
        return release;
      },
      getLatestCommit: async () => {
        calls.push("commit");
        return commit;
      },
    });

    const pending = getProjectStatus(client, slug, fixedNow);

    // All five calls must be in flight before the first one settles; a
    // sequential implementation would only have recorded "repository" here.
    expect(calls.sort()).toEqual([
      "commit",
      "issues",
      "pullRequests",
      "release",
      "repository",
    ]);

    await pending;
  });
});

describe("getProjectStatuses", () => {
  it("returns an empty list when nothing is tracked", async () => {
    await expect(getProjectStatuses(fakeClient(), [], fixedNow)).resolves.toEqual([]);
  });

  it("preserves the order of the requested repositories", async () => {
    const client = fakeClient({
      getRepository: async (target) => ({ ...repository, name: target.name }),
    });

    const results = await getProjectStatuses(client, [otherSlug, slug], fixedNow);

    expect(results.map((result) => result.ok && result.status.repository.name)).toEqual([
      "PinnStatus",
      "roadmap",
    ]);
  });

  it("isolates a failing repository instead of failing the whole list", async () => {
    const client = fakeClient({
      getRepository: async (target) => {
        if (sameRepository(target, otherSlug)) {
          throw new GitHubError("GitHub request failed with status 404", {
            code: "not_found",
            status: 404,
          });
        }

        return repository;
      },
    });

    const results = await getProjectStatuses(client, [slug, otherSlug], fixedNow);

    expect(results[0].ok).toBe(true);
    expect(results[1]).toMatchObject({
      ok: false,
      repository: otherSlug,
      error: expect.objectContaining({ code: "not_found" }),
    });
  });

  it("wraps an unexpected failure as an upstream GitHubError", async () => {
    const cause = new Error("boom");
    const client = fakeClient({
      countOpenIssues: async () => {
        throw cause;
      },
    });

    const [result] = await getProjectStatuses(client, [slug], fixedNow);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeInstanceOf(GitHubError);
    expect(result.ok === false && result.error.code).toBe("upstream");
    expect(result.ok === false && result.error.cause).toBe(cause);
  });
});
