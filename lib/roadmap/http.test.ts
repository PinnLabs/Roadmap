import { describe, expect, it, vi } from "vitest";

import { GitHubError } from "../github/errors";
import type { GitHubClient, GitHubRepository } from "../github/types";
import { parseRepositorySlug } from "../repository-slug";
import { ConfigurationError } from "./errors";
import { handleProjectsRequest, type ProjectsHandlerDependencies } from "./http";
import type { RoadmapConfig } from "./config";
import type { ProjectStatus } from "./types";

function request(path: string): Request {
  return new Request(`https://roadmap.test${path}`);
}

function configWith(
  repositories: string[],
  includePrivateRepositories = false,
): RoadmapConfig {
  return {
    token: null,
    apiBaseUrl: null,
    trackedRepositories: repositories.map(
      (repository) => parseRepositorySlug(repository)!,
    ),
    includePrivateRepositories,
  };
}

function githubRepo(
  name: string,
  visibility: "public" | "private" = "public",
): GitHubRepository {
  return {
    id: 1,
    owner: "PinnLabs",
    name,
    fullName: `PinnLabs/${name}`,
    description: null,
    url: `https://github.com/PinnLabs/${name}`,
    homepage: null,
    defaultBranch: "main",
    visibility,
    archived: false,
    stars: 0,
    forks: 0,
    openIssues: 0,
    pushedAt: null,
    createdAt: null,
  };
}

function fakeClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getRepository: async (slug) => githubRepo(slug.name),
    countOpenIssues: async () => 0,
    countOpenPullRequests: async () => 0,
    getLatestRelease: async () => null,
    getLatestCommit: async () => null,
    ...overrides,
  };
}

function deps(
  overrides: Partial<ProjectsHandlerDependencies> = {},
): ProjectsHandlerDependencies {
  return {
    loadConfig: () => configWith([]),
    createClient: () => fakeClient(),
    now: () => new Date("2026-06-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("handleProjectsRequest — collection", () => {
  it("reports an empty roadmap when nothing is tracked", async () => {
    const response = await handleProjectsRequest(request("/api/projects"), deps());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ projects: [], errors: [] });
  });

  it("returns every tracked repository in order", async () => {
    const config = configWith(["PinnLabs/roadmap", "PinnLabs/PinnStatus"]);

    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({ loadConfig: () => config }),
    );

    const body = (await response.json()) as {
      projects: ProjectStatus[];
      errors: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.projects.map((project) => project.repository.name)).toEqual([
      "roadmap",
      "PinnStatus",
    ]);
    expect(body.projects[0].fetchedAt).toBe("2026-06-01T12:00:00.000Z");
    expect(body.errors).toEqual([]);
  });

  it("isolates a failing repository instead of failing the request", async () => {
    const config = configWith(["PinnLabs/roadmap", "PinnLabs/PinnStatus"]);
    const client = fakeClient({
      getRepository: async (slug) => {
        if (slug.name === "PinnStatus") {
          throw new GitHubError("GitHub request failed with status 404", {
            code: "not_found",
            status: 404,
          });
        }

        return githubRepo(slug.name);
      },
    });

    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({ loadConfig: () => config, createClient: () => client }),
    );

    const body = (await response.json()) as {
      projects: ProjectStatus[];
      errors: Array<{ repository: string; error: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.projects.map((project) => project.repository.fullName)).toEqual([
      "PinnLabs/roadmap",
    ]);
    expect(body.errors).toEqual([
      { repository: "PinnLabs/PinnStatus", error: "not_found" },
    ]);
  });

  it("classifies an unexpected failure as an upstream error", async () => {
    const config = configWith(["PinnLabs/roadmap"]);
    const client = fakeClient({
      getRepository: async () => {
        throw new Error("boom");
      },
    });

    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({ loadConfig: () => config, createClient: () => client }),
    );

    const body = (await response.json()) as {
      errors: Array<{ repository: string; error: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.errors).toEqual([
      { repository: "PinnLabs/roadmap", error: "upstream" },
    ]);
  });
});

describe("handleProjectsRequest — single repository", () => {
  it("returns a tracked repository", async () => {
    const response = await handleProjectsRequest(
      request("/api/projects?repo=PinnLabs/roadmap"),
      deps({ loadConfig: () => configWith(["PinnLabs/roadmap"]) }),
    );

    const body = (await response.json()) as { project: ProjectStatus };

    expect(response.status).toBe(200);
    expect(body.project.repository.fullName).toBe("PinnLabs/roadmap");
  });

  it("matches the allowlist case-insensitively and tolerates surrounding spaces", async () => {
    const response = await handleProjectsRequest(
      request("/api/projects?repo=%20pinnlabs/ROADMAP%20"),
      deps({ loadConfig: () => configWith(["PinnLabs/roadmap"]) }),
    );

    expect(response.status).toBe(200);
  });

  it("answers 404 for a repository outside the allowlist without calling GitHub", async () => {
    const createClient = vi.fn(() => fakeClient());

    const response = await handleProjectsRequest(
      request("/api/projects?repo=torvalds/linux"),
      deps({ loadConfig: () => configWith(["PinnLabs/roadmap"]), createClient }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", "/api/projects?repo="],
    ["traversal", "/api/projects?repo=..%2F..%2Fetc%2Fpasswd"],
    ["no separator", "/api/projects?repo=roadmap"],
    ["extra segment", "/api/projects?repo=a/b/c"],
  ])("answers 400 for a malformed repository (%s)", async (_label, path) => {
    const response = await handleProjectsRequest(
      request(path),
      deps({ loadConfig: () => configWith(["PinnLabs/roadmap"]) }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_repository" });
  });
});

describe("handleProjectsRequest — private repositories", () => {
  it("hides private repositories by default", async () => {
    const config = configWith(["PinnLabs/secret"], false);
    const client = fakeClient({
      getRepository: async (slug) => githubRepo(slug.name, "private"),
    });
    const handlerDeps = deps({ loadConfig: () => config, createClient: () => client });

    const listed = await handleProjectsRequest(request("/api/projects"), handlerDeps);

    expect(await listed.json()).toEqual({ projects: [], errors: [] });

    const single = await handleProjectsRequest(
      request("/api/projects?repo=PinnLabs/secret"),
      handlerDeps,
    );

    expect(single.status).toBe(404);
    await expect(single.json()).resolves.toEqual({ error: "not_found" });
  });

  it("exposes private repositories when explicitly opted in", async () => {
    const config = configWith(["PinnLabs/secret"], true);
    const client = fakeClient({
      getRepository: async (slug) => githubRepo(slug.name, "private"),
    });

    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({ loadConfig: () => config, createClient: () => client }),
    );

    const body = (await response.json()) as { projects: ProjectStatus[] };

    expect(body.projects).toHaveLength(1);
    expect(body.projects[0].repository.visibility).toBe("private");
  });
});

describe("handleProjectsRequest — error mapping", () => {
  const failingClient = (error: GitHubError) =>
    fakeClient({
      getRepository: async () => {
        throw error;
      },
    });

  async function statusFor(error: GitHubError): Promise<Response> {
    return handleProjectsRequest(
      request("/api/projects?repo=PinnLabs/roadmap"),
      deps({
        loadConfig: () => configWith(["PinnLabs/roadmap"]),
        createClient: () => failingClient(error),
      }),
    );
  }

  it("maps not_found to 404", async () => {
    const response = await statusFor(
      new GitHubError("not found", { code: "not_found", status: 404 }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("maps rate_limited to 429 and forwards Retry-After", async () => {
    const response = await statusFor(
      new GitHubError("rate limited", {
        code: "rate_limited",
        status: 403,
        retryAfterSeconds: 30,
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual({ error: "rate_limited" });
  });

  it("maps unauthorized to a 502 upstream error", async () => {
    const response = await statusFor(
      new GitHubError("bad credentials", { code: "unauthorized", status: 401 }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "upstream_unauthorized",
    });
  });

  it("maps a timeout to 504", async () => {
    const response = await statusFor(
      new GitHubError("timed out", { code: "timeout" }),
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ error: "upstream_timeout" });
  });

  it("maps a network failure to 502", async () => {
    const response = await statusFor(new GitHubError("offline", { code: "network" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "upstream_unavailable",
    });
  });

  it("maps an unexpected failure to 500", async () => {
    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({
        loadConfig: () => configWith([]),
        createClient: () => {
          throw new Error("boom");
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "internal_error" });
  });

  it("reports a misconfigured server without echoing the configuration", async () => {
    const response = await handleProjectsRequest(
      request("/api/projects"),
      deps({
        loadConfig: () => {
          throw new ConfigurationError(
            "GITHUB_TRACKED_REPOS contains an entry that is not a valid owner/name slug",
          );
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "server_misconfigured" });
  });
});

describe("handleProjectsRequest — response hardening", () => {
  it("sends defensive headers", async () => {
    const response = await handleProjectsRequest(request("/api/projects"), deps());

    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("does not add permissive CORS headers", async () => {
    const response = await handleProjectsRequest(request("/api/projects"), deps());

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
