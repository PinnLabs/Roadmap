import { describe, expect, it } from "vitest";

import type { RepositorySlug } from "../repository-slug";
import { createGitHubClient } from "./client";
import { GitHubError } from "./errors";

const slug: RepositorySlug = { owner: "PinnLabs", name: "roadmap" };

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

type FetchImpl = typeof fetch;

function recordingFetch(
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
): { calls: Array<{ url: string; init: RequestInit }>; fetchImpl: FetchImpl } {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const fetchImpl: FetchImpl = async (input, init) => {
    const url = new URL(String(input));
    const requestInit = init ?? {};
    calls.push({ url: url.toString(), init: requestInit });
    return handler(url, requestInit);
  };

  return { calls, fetchImpl };
}

const rawRepository = {
  id: 42,
  node_id: "R_kgDO_ignored",
  name: "roadmap",
  full_name: "PinnLabs/roadmap",
  owner: { login: "PinnLabs", id: 1 },
  description: "Public roadmap for PinnLabs projects.",
  html_url: "https://github.com/PinnLabs/roadmap",
  homepage: "https://pinnlabs.dev/roadmap",
  default_branch: "main",
  visibility: "public",
  private: false,
  archived: false,
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 5,
  pushed_at: "2026-01-02T03:04:05Z",
  created_at: "2025-01-01T00:00:00Z",
};

describe("createGitHubClient request handling", () => {
  it("targets the GitHub REST API with the repository path", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/PinnLabs/roadmap");
    expect(calls[0].init.method ?? "GET").toBe("GET");
  });

  it("sends the expected protocol headers", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    const headers = new Headers(calls[0].init.headers);

    expect(headers.get("accept")).toBe("application/vnd.github+json");
    expect(headers.get("x-github-api-version")).toBe("2026-03-10");
    expect(headers.get("user-agent")).toBe("pinnlabs-roadmap");
  });

  it("omits the authorization header when no token is configured", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    expect(new Headers(calls[0].init.headers).get("authorization")).toBeNull();
  });

  it("authenticates with a bearer token when one is configured", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ token: "ghp_example", fetch: fetchImpl }).getRepository(
      slug,
    );

    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(
      "Bearer ghp_example",
    );
  });

  it("supports a custom base URL, including a path prefix", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({
      baseUrl: "https://github.enterprise.test/api/v3/",
      fetch: fetchImpl,
    }).getRepository(slug);

    expect(calls[0].url).toBe(
      "https://github.enterprise.test/api/v3/repos/PinnLabs/roadmap",
    );
  });

  it("allows the user agent to be overridden", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ userAgent: "custom-agent", fetch: fetchImpl }).getRepository(
      slug,
    );

    expect(new Headers(calls[0].init.headers).get("user-agent")).toBe("custom-agent");
  });

  it("attaches an abort signal so requests cannot hang forever", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("getOrganization", () => {
  it("requests the organization and maps its follower count", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({
        login: "PinnLabs",
        id: 7,
        name: "PinnLabs",
        html_url: "https://github.com/PinnLabs",
        avatar_url: "https://avatars.githubusercontent.com/u/7",
        followers: 12400,
      }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getOrganization("PinnLabs"),
    ).resolves.toEqual({
      login: "PinnLabs",
      name: "PinnLabs",
      url: "https://github.com/PinnLabs",
      avatarUrl: "https://avatars.githubusercontent.com/u/7",
      followers: 12400,
    });
    expect(calls[0].url).toBe("https://api.github.com/orgs/PinnLabs");
  });

  it("falls back to zero followers when the count is missing", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ login: "PinnLabs" }));

    const organization = await createGitHubClient({ fetch: fetchImpl }).getOrganization(
      "PinnLabs",
    );

    expect(organization.followers).toBe(0);
  });
});

describe("getRepository", () => {
  it("maps the payload onto a minimal DTO", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse(rawRepository));

    await expect(createGitHubClient({ fetch: fetchImpl }).getRepository(slug)).resolves.toEqual({
      id: 42,
      owner: "PinnLabs",
      name: "roadmap",
      fullName: "PinnLabs/roadmap",
      description: "Public roadmap for PinnLabs projects.",
      url: "https://github.com/PinnLabs/roadmap",
      homepage: "https://pinnlabs.dev/roadmap",
      defaultBranch: "main",
      visibility: "public",
      archived: false,
      stars: 12,
      forks: 3,
      openIssues: 5,
      pushedAt: "2026-01-02T03:04:05Z",
      createdAt: "2025-01-01T00:00:00Z",
    });
  });

  it.each([
    [{ visibility: "private", private: true }, "private"],
    [{ visibility: "internal", private: true }, "private"],
    [{ visibility: undefined, private: true }, "private"],
    [{ visibility: undefined, private: false }, "public"],
  ])("resolves visibility %j as %s", async (overrides, expected) => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ ...rawRepository, ...overrides }),
    );

    const repository = await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    expect(repository.visibility).toBe(expected);
  });

  it("fails safe to private when visibility is unknown", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ ...rawRepository, visibility: undefined, private: undefined }),
    );

    const repository = await createGitHubClient({ fetch: fetchImpl }).getRepository(slug);

    expect(repository.visibility).toBe("private");
  });
});

describe("issue and pull request counts", () => {
  it("counts open issues through the search API", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({ total_count: 7, items: [] }),
    );

    const count = await createGitHubClient({ fetch: fetchImpl }).countOpenIssues(slug);

    expect(count).toBe(7);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/search/issues");
    expect(url.searchParams.get("q")).toBe(
      "repo:PinnLabs/roadmap type:issue state:open",
    );
  });

  it("counts open pull requests through the search API", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({ total_count: 2, items: [] }),
    );

    const count = await createGitHubClient({ fetch: fetchImpl }).countOpenPullRequests(
      slug,
    );

    expect(count).toBe(2);
    expect(new URL(calls[0].url).searchParams.get("q")).toBe(
      "repo:PinnLabs/roadmap type:pr state:open",
    );
  });

  it("coerces a missing count to zero", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ items: [] }));

    await expect(
      createGitHubClient({ fetch: fetchImpl }).countOpenIssues(slug),
    ).resolves.toBe(0);
  });


  it.each([
    ["issues" as const],
    ["pullRequests" as const],
  ])("treats an unsearchable repository as not found (%s)", async (kind) => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        {
          message: "Validation Failed",
          errors: [{ resource: "Search", field: "q", code: "invalid" }],
        },
        { status: 422 },
      ),
    );

    const client = createGitHubClient({ fetch: fetchImpl });
    const call =
      kind === "issues" ? client.countOpenIssues(slug) : client.countOpenPullRequests(slug);

    await expect(call).rejects.toMatchObject({ code: "not_found", status: 422 });
  });
});

describe("getLatestRelease", () => {
  it("maps the latest release", async () => {
    const { calls, fetchImpl } = recordingFetch(() =>
      jsonResponse({
        tag_name: "v1.2.0",
        name: "Roadmap 1.2.0",
        html_url: "https://github.com/PinnLabs/roadmap/releases/tag/v1.2.0",
        prerelease: false,
        published_at: "2026-02-01T00:00:00Z",
      }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getLatestRelease(slug),
    ).resolves.toEqual({
      tag: "v1.2.0",
      name: "Roadmap 1.2.0",
      url: "https://github.com/PinnLabs/roadmap/releases/tag/v1.2.0",
      prerelease: false,
      publishedAt: "2026-02-01T00:00:00Z",
    });

    expect(calls[0].url).toBe("https://api.github.com/repos/PinnLabs/roadmap/releases/latest");
  });

  it("returns null when the repository has no releases", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getLatestRelease(slug),
    ).resolves.toBeNull();
  });
});

describe("getLatestCommit", () => {
  const rawCommit = {
    sha: "abc123",
    html_url: "https://github.com/PinnLabs/roadmap/commit/abc123",
    author: { login: "felipecastro" },
    commit: {
      message: "feat: add project status endpoint\n\nLonger body ignored.",
      committer: { date: "2026-03-01T10:00:00Z" },
    },
  };

  it("maps the first commit of the default branch", async () => {
    const { calls, fetchImpl } = recordingFetch(() => jsonResponse([rawCommit]));

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getLatestCommit(slug),
    ).resolves.toEqual({
      sha: "abc123",
      message: "feat: add project status endpoint",
      url: "https://github.com/PinnLabs/roadmap/commit/abc123",
      authorLogin: "felipecastro",
      committedAt: "2026-03-01T10:00:00Z",
    });

    expect(calls[0].url).toBe(
      "https://api.github.com/repos/PinnLabs/roadmap/commits?per_page=1",
    );
  });

  it("returns null for an empty repository", async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse([]));

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getLatestCommit(slug),
    ).resolves.toBeNull();
  });

  it("returns null when GitHub reports an empty git repository", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: "Git Repository is empty." }, { status: 409 }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getLatestCommit(slug),
    ).resolves.toBeNull();
  });

  it("ignores an author that GitHub cannot match to a user", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse([{ ...rawCommit, author: null }]),
    );

    const commit = await createGitHubClient({ fetch: fetchImpl }).getLatestCommit(slug);

    expect(commit?.authorLogin).toBeNull();
  });
});

describe("error mapping", () => {
  it("maps 401 to an unauthorized error", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: "Bad credentials" }, { status: 401 }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("maps 404 to a not found error", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("maps 5xx responses to an upstream error", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: "Server Error" }, { status: 503 }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "upstream", status: 503 });
  });

  it("maps a 403 with an exhausted rate limit to a rate limited error", async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetAt),
          },
        },
      ),
    );

    const error = await createGitHubClient({ fetch: fetchImpl })
      .getRepository(slug)
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toMatchObject({ code: "rate_limited", status: 403 });
    expect((error as GitHubError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("honours the retry-after header on 429 responses", async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse(
        { message: "Too Many Requests" },
        { status: 429, headers: { "retry-after": "30" } },
      ),
    );

    const error = await createGitHubClient({ fetch: fetchImpl })
      .getRepository(slug)
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "rate_limited", retryAfterSeconds: 30 });
  });

  it("never echoes the token back in an error message", async () => {
    const token = "ghp_supersecrettoken";
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ message: `Bad credentials for ${token}` }, { status: 401 }),
    );

    const error = (await createGitHubClient({ token, fetch: fetchImpl })
      .getRepository(slug)
      .catch((reason: unknown) => reason)) as GitHubError;

    expect(error.message).not.toContain(token);
  });

  it("maps an aborted request to a timeout error", async () => {
    const fetchImpl: FetchImpl = async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    };

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps a transport failure to a network error", async () => {
    const fetchImpl: FetchImpl = async () => {
      throw new TypeError("fetch failed");
    };

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("maps an unparseable body to an upstream error", async () => {
    const { fetchImpl } = recordingFetch(
      () =>
        new Response("<!doctype html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );

    await expect(
      createGitHubClient({ fetch: fetchImpl }).getRepository(slug),
    ).rejects.toMatchObject({ code: "upstream" });
  });
});
