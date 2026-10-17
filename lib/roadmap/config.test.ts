import { describe, expect, it } from "vitest";

import { ConfigurationError } from "./errors";
import {
  loadRoadmapConfig,
  parseApiBaseUrl,
  parseBoolean,
  parseOrganization,
  parseTrackedRepositories,
} from "./config";

describe("parseTrackedRepositories", () => {
  it("returns an empty allowlist when unset", () => {
    expect(parseTrackedRepositories(undefined)).toEqual([]);
    expect(parseTrackedRepositories(null)).toEqual([]);
    expect(parseTrackedRepositories("")).toEqual([]);
    expect(parseTrackedRepositories("   ")).toEqual([]);
  });

  it("parses a comma-separated list and trims each entry", () => {
    expect(parseTrackedRepositories("PinnLabs/roadmap, PinnLabs/PinnStatus")).toEqual(
      [
        { owner: "PinnLabs", name: "roadmap" },
        { owner: "PinnLabs", name: "PinnStatus" },
      ],
    );
  });

  it("ignores empty entries", () => {
    expect(parseTrackedRepositories("PinnLabs/roadmap,,  ,PinnLabs/PinnStatus,")).toEqual(
      [
        { owner: "PinnLabs", name: "roadmap" },
        { owner: "PinnLabs", name: "PinnStatus" },
      ],
    );
  });

  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    expect(parseTrackedRepositories("PinnLabs/roadmap, pinnlabs/ROADMAP")).toEqual([
      { owner: "PinnLabs", name: "roadmap" },
    ]);
  });

  it("throws a ConfigurationError for an invalid entry", () => {
    expect(() => parseTrackedRepositories("PinnLabs/roadmap, not-a-slug")).toThrow(
      ConfigurationError,
    );
  });

  it("does not leak the offending value in the error message", () => {
    const secret = "ghp_supersecrettokenvalue";

    expect(() => parseTrackedRepositories(secret)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(secret),
      }),
    );
  });
});

describe("parseBoolean", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["yes", true],
    ["on", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["off", false],
  ])("parses %j as %s", (input, expected) => {
    expect(parseBoolean(input)).toBe(expected);
  });

  it("falls back for unset, empty, or unrecognized values", () => {
    expect(parseBoolean(undefined)).toBe(false);
    expect(parseBoolean(null, true)).toBe(true);
    expect(parseBoolean("")).toBe(false);
    expect(parseBoolean("maybe", true)).toBe(true);
  });
});

describe("parseApiBaseUrl", () => {
  it("defaults to null when unset or blank", () => {
    expect(parseApiBaseUrl(undefined)).toBeNull();
    expect(parseApiBaseUrl(null)).toBeNull();
    expect(parseApiBaseUrl("   ")).toBeNull();
  });

  it.each([
    "https://ghe.example.com/api/v3",
    "http://localhost:8080/api/v3",
    "https://api.github.com",
  ])("accepts %s", (value) => {
    expect(parseApiBaseUrl(value)).not.toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseApiBaseUrl("  https://ghe.example.com/api/v3  ")).toBe(
      "https://ghe.example.com/api/v3",
    );
  });

  it.each([
    "ftp://ghe.example.com",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "not a url",
    "ghe.example.com/api/v3",
  ])("rejects %j as a ConfigurationError", (value) => {
    expect(() => parseApiBaseUrl(value)).toThrow(ConfigurationError);
  });

  it("does not leak the offending value in the error message", () => {
    const value = "ftp://user:supersecret@ghe.example.com";

    expect(() => parseApiBaseUrl(value)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("supersecret"),
      }),
    );
  });
});

describe("parseOrganization", () => {
  const tracked = [{ owner: "PinnLabs", name: "roadmap" }];

  it("uses an explicit organization", () => {
    expect(parseOrganization("  Acme-Org ", tracked)).toBe("Acme-Org");
  });

  it("falls back to the owner of the first tracked repository", () => {
    expect(parseOrganization(undefined, tracked)).toBe("PinnLabs");
    expect(parseOrganization("   ", tracked)).toBe("PinnLabs");
  });

  it("is null when nothing identifies an organization", () => {
    expect(parseOrganization(undefined, [])).toBeNull();
  });

  it.each(["-leading", "trailing-", "double--dash", "has/slash", "a".repeat(40)])(
    "rejects %s",
    (value) => {
      expect(() => parseOrganization(value, tracked)).toThrow(ConfigurationError);
    },
  );
});

describe("loadRoadmapConfig", () => {
  it("defaults to no token, no repositories, and private repositories hidden", () => {
    expect(loadRoadmapConfig({})).toEqual({
      token: null,
      apiBaseUrl: null,
      trackedRepositories: [],
      includePrivateRepositories: false,
      organization: null,
    });
  });

  it("reads configuration from the environment", () => {
    expect(
      loadRoadmapConfig({
        GITHUB_TOKEN: "  ghp_example  ",
        GITHUB_API_BASE_URL: "https://ghe.example.com/api/v3",
        GITHUB_TRACKED_REPOS: "PinnLabs/roadmap",
        GITHUB_INCLUDE_PRIVATE: "true",
      }),
    ).toEqual({
      token: "ghp_example",
      apiBaseUrl: "https://ghe.example.com/api/v3",
      trackedRepositories: [{ owner: "PinnLabs", name: "roadmap" }],
      includePrivateRepositories: true,
      organization: "PinnLabs",
    });
  });

  it("treats a blank token as no token", () => {
    expect(loadRoadmapConfig({ GITHUB_TOKEN: "   " }).token).toBeNull();
  });

  it("surfaces a ConfigurationError for an invalid allowlist", () => {
    expect(() =>
      loadRoadmapConfig({ GITHUB_TRACKED_REPOS: "not-a-slug" }),
    ).toThrow(ConfigurationError);
  });
});
