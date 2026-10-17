import { describe, expect, it } from "vitest";

import {
  ALL_PROJECTS,
  filterProjects,
  resolveProject,
  summarizeProjects,
} from "./project-filter";
import type { ProjectStatus } from "./types";

function project(
  name: string,
  overrides: { description?: string; issues?: number; prs?: number; stars?: number } = {},
): ProjectStatus {
  return {
    repository: {
      owner: "PinnLabs",
      name,
      fullName: `PinnLabs/${name}`,
      description: overrides.description ?? null,
      url: `https://github.com/PinnLabs/${name}`,
      homepage: null,
      visibility: "public",
      defaultBranch: "main",
      archived: false,
      stars: overrides.stars ?? 0,
      forks: 1,
      createdAt: null,
      pushedAt: null,
    },
    issues: { open: overrides.issues ?? 0 },
    pullRequests: { open: overrides.prs ?? 0 },
    latestRelease: null,
    latestCommit: {
      sha: "abc",
      message: `chore: bump ${name}`,
      url: "https://github.com/PinnLabs/x/commit/abc",
      authorLogin: null,
      committedAt: null,
    },
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
}

const projects = [
  project("roadmap", { description: "Public roadmap", issues: 3, prs: 1, stars: 10 }),
  project("PinnStatus", { description: "Status page", issues: 2, prs: 4, stars: 5 }),
];

describe("resolveProject", () => {
  it("defaults to all projects", () => {
    expect(resolveProject(null, projects)).toBe(ALL_PROJECTS);
    expect(resolveProject("", projects)).toBe(ALL_PROJECTS);
  });

  it("matches a known project case-insensitively", () => {
    expect(resolveProject("pinnlabs/ROADMAP", projects)).toBe("PinnLabs/roadmap");
  });

  it("falls back to all projects for an unknown one", () => {
    expect(resolveProject("PinnLabs/secret", projects)).toBe(ALL_PROJECTS);
  });
});

describe("filterProjects", () => {
  it("returns everything for the default filter", () => {
    expect(filterProjects(projects, { project: ALL_PROJECTS, query: "" })).toHaveLength(2);
  });

  it("narrows to the selected project", () => {
    const result = filterProjects(projects, { project: "PinnLabs/PinnStatus", query: "" });
    expect(result.map((p) => p.repository.name)).toEqual(["PinnStatus"]);
  });

  it("matches every query term across name, description and commit", () => {
    expect(
      filterProjects(projects, { project: ALL_PROJECTS, query: "public ROADMAP" }),
    ).toHaveLength(1);
    expect(filterProjects(projects, { project: ALL_PROJECTS, query: "bump" })).toHaveLength(2);
    expect(filterProjects(projects, { project: ALL_PROJECTS, query: "nope" })).toEqual([]);
  });
});

describe("summarizeProjects", () => {
  it("totals the status counters", () => {
    expect(summarizeProjects(projects)).toEqual({
      repositories: 2,
      openIssues: 5,
      openPullRequests: 5,
      stars: 15,
      forks: 2,
    });
  });
});
