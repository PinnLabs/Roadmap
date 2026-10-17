import { describe, expect, it } from "vitest";

import type { GitHubIssue } from "../github/types";
import { filterRoadmapItems, groupByStage, priorityFromLabels, toRoadmapItems } from "./board";

const now = new Date("2026-10-17T00:00:00Z");

function issue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    number: 1,
    title: "Item",
    url: "https://github.com/PinnLabs/roadmap/issues/1",
    state: "open",
    isPullRequest: false,
    mergedAt: null,
    labels: [],
    assignees: [],
    milestone: null,
    comments: 0,
    updatedAt: "2026-10-10T00:00:00Z",
    closedAt: null,
    ...overrides,
  };
}

function stageOf(overrides: Partial<GitHubIssue>) {
  return toRoadmapItems("PinnLabs/roadmap", [issue(overrides)], now)[0]?.stage ?? null;
}

describe("toRoadmapItems stage inference", () => {
  it("puts unassigned open issues in the backlog", () => {
    expect(stageOf({})).toBe("backlog");
  });

  it("treats assigned or in-progress labelled issues as in progress", () => {
    expect(stageOf({ assignees: [{ login: "felipe", avatarUrl: null }] })).toBe("in_progress");
    expect(stageOf({ labels: ["status: in progress"] })).toBe("in_progress");
  });

  it("treats open pull requests as in review", () => {
    expect(stageOf({ isPullRequest: true })).toBe("in_review");
  });

  it("shows recently closed issues and merged pull requests as shipped", () => {
    expect(stageOf({ state: "closed", closedAt: "2026-10-01T00:00:00Z" })).toBe("shipped");
    expect(
      stageOf({ state: "closed", isPullRequest: true, mergedAt: "2026-10-15T00:00:00Z" }),
    ).toBe("shipped");
  });

  it("drops abandoned pull requests and old closed work", () => {
    expect(
      stageOf({ state: "closed", isPullRequest: true, closedAt: "2026-10-15T00:00:00Z" }),
    ).toBeNull();
    expect(stageOf({ state: "closed", closedAt: "2026-01-01T00:00:00Z" })).toBeNull();
  });

  it("builds a cross-repository id and milestone progress", () => {
    const [item] = toRoadmapItems(
      "PinnLabs/roadmap",
      [
        issue({
          number: 12,
          milestone: { title: "v1", dueOn: null, openIssues: 1, closedIssues: 3 },
        }),
      ],
      now,
    );

    expect(item.id).toBe("PinnLabs/roadmap#12");
    expect(item.milestone).toEqual({ title: "v1", dueOn: null, progress: 75 });
  });
});

describe("priorityFromLabels", () => {
  it.each([
    [["priority: critical"], "urgent"],
    [["P1"], "high"],
    [["priority/medium"], "normal"],
    [["low-priority"], "low"],
    [["bug", "enhancement"], null],
  ])("maps %j to %s", (labels, expected) => {
    expect(priorityFromLabels(labels)).toBe(expected);
  });
});

describe("groupByStage", () => {
  it("orders each stage by priority, then recency", () => {
    const items = toRoadmapItems(
      "PinnLabs/roadmap",
      [
        issue({ number: 1, updatedAt: "2026-10-01T00:00:00Z" }),
        issue({ number: 2, updatedAt: "2026-10-12T00:00:00Z" }),
        issue({ number: 3, labels: ["priority: high"], updatedAt: "2026-09-01T00:00:00Z" }),
      ],
      now,
    );

    expect(groupByStage(items).backlog.map((item) => item.number)).toEqual([3, 2, 1]);
  });
});

describe("filterRoadmapItems", () => {
  const items = [
    ...toRoadmapItems("PinnLabs/roadmap", [issue({ number: 1, title: "Kanban view" })], now),
    ...toRoadmapItems(
      "PinnLabs/PinnStatus",
      [issue({ number: 2, title: "Uptime chart", labels: ["enhancement"] })],
      now,
    ),
  ];

  it("keeps everything for all projects and no query", () => {
    expect(filterRoadmapItems(items, { project: "all", query: "" })).toHaveLength(2);
  });

  it("narrows to one repository", () => {
    expect(
      filterRoadmapItems(items, { project: "pinnlabs/pinnstatus", query: "" }).map((i) => i.number),
    ).toEqual([2]);
  });

  it("matches title, label and issue number", () => {
    expect(filterRoadmapItems(items, { project: "all", query: "kanban" })).toHaveLength(1);
    expect(filterRoadmapItems(items, { project: "all", query: "enhancement" })).toHaveLength(1);
    expect(filterRoadmapItems(items, { project: "all", query: "#2" })).toHaveLength(1);
  });
});
