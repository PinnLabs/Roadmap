import { describe, expect, it } from "vitest";

import {
  formatRepositorySlug,
  isTrackedRepository,
  parseRepositorySlug,
  sameRepository,
} from "./repository-slug";

describe("parseRepositorySlug", () => {
  it("parses an owner/name slug", () => {
    expect(parseRepositorySlug("PinnLabs/roadmap")).toEqual({
      owner: "PinnLabs",
      name: "roadmap",
    });
  });

  it("preserves the original casing", () => {
    expect(parseRepositorySlug("My-Org/My.Repo_name-1")).toEqual({
      owner: "My-Org",
      name: "My.Repo_name-1",
    });
  });

  it("accepts the maximum lengths allowed by GitHub", () => {
    const owner = "a".repeat(39);
    const name = "b".repeat(100);

    expect(parseRepositorySlug(`${owner}/${name}`)).toEqual({ owner, name });
  });

  it("accepts a name that starts with a dot, such as .github", () => {
    expect(parseRepositorySlug("PinnLabs/.github")).toEqual({
      owner: "PinnLabs",
      name: ".github",
    });
  });

  it.each([
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["roadmap", "missing owner"],
    ["owner/", "missing name"],
    ["/name", "missing owner"],
    ["a/b/c", "too many segments"],
    ["owner/../etc", "path traversal"],
    ["owner/.", "single-dot name"],
    ["owner/..", "double-dot name"],
    ["-owner/repo", "owner starting with a hyphen"],
    ["owner-/repo", "owner ending with a hyphen"],
    ["own.er/repo", "dot in the owner"],
    ["own_er/repo", "underscore in the owner"],
    ["own er/repo", "space in the owner"],
    ["owner/re po", "space in the name"],
    ["owner/re%2fpo", "encoded separator"],
    ["owner/repo?x=1", "query string"],
    ["owner/repo#frag", "fragment"],
    ["owner\\repo", "backslash separator"],
    [`${"a".repeat(40)}/repo`, "owner too long"],
    [`owner/${"b".repeat(101)}`, "name too long"],
  ])("rejects %j (%s)", (input) => {
    expect(parseRepositorySlug(input)).toBeNull();
  });
});

describe("formatRepositorySlug", () => {
  it("round-trips a parsed slug", () => {
    const slug = parseRepositorySlug("PinnLabs/roadmap");

    expect(slug).not.toBeNull();
    expect(formatRepositorySlug(slug!)).toBe("PinnLabs/roadmap");
  });
});

describe("sameRepository", () => {
  it("compares owners and names case-insensitively", () => {
    expect(
      sameRepository(
        { owner: "PinnLabs", name: "Roadmap" },
        { owner: "pinnlabs", name: "roadmap" },
      ),
    ).toBe(true);
  });

  it("distinguishes different repositories", () => {
    expect(
      sameRepository(
        { owner: "PinnLabs", name: "roadmap" },
        { owner: "PinnLabs", name: "pinnstatus" },
      ),
    ).toBe(false);
  });
});

describe("isTrackedRepository", () => {
  const tracked = [
    { owner: "PinnLabs", name: "roadmap" },
    { owner: "PinnLabs", name: "PinnStatus" },
  ];

  it("matches case-insensitively", () => {
    expect(isTrackedRepository({ owner: "pinnlabs", name: "ROADMAP" }, tracked)).toBe(
      true,
    );
  });

  it("rejects repositories outside the allowlist", () => {
    expect(isTrackedRepository({ owner: "torvalds", name: "linux" }, tracked)).toBe(
      false,
    );
  });

  it("returns false for an empty allowlist", () => {
    expect(isTrackedRepository({ owner: "PinnLabs", name: "roadmap" }, [])).toBe(
      false,
    );
  });
});
