import { describe, expect, it } from "vitest";

import { toRoadmapItems } from "@/lib/roadmap/board";

import { toKanbanColumns } from "./to-columns";

const now = new Date("2026-10-17T00:00:00Z");

describe("toKanbanColumns", () => {
  it("always renders the four stages in order", () => {
    expect(toKanbanColumns([], now).map((column) => column.name)).toEqual([
      "Backlog",
      "In progress",
      "In review",
      "Shipped",
    ]);
  });

  it("maps an item onto a linked card with milestone details", () => {
    const items = toRoadmapItems(
      "PinnLabs/roadmap",
      [
        {
          number: 12,
          title: "Kanban view",
          url: "https://github.com/PinnLabs/roadmap/issues/12",
          state: "open",
          isPullRequest: false,
          mergedAt: null,
          labels: ["priority: high"],
          assignees: [{ login: "felipe", avatarUrl: "https://avatars/1" }],
          milestone: { title: "v1", dueOn: "2026-10-20T00:00:00Z", openIssues: 1, closedIssues: 1 },
          comments: 1,
          updatedAt: null,
          closedAt: null,
        },
      ],
      now,
    );

    const [, inProgress] = toKanbanColumns(items, now);

    expect(inProgress.tasks).toEqual([
      {
        id: "PinnLabs/roadmap#12",
        title: "Kanban view",
        note: "#12 · v1 · 1 comment",
        priority: "high",
        category: "roadmap",
        icon: "issue",
        assignees: [{ name: "felipe", avatar: "https://avatars/1" }],
        due: "Oct 20",
        dueSoon: true,
        progress: 50,
        href: "https://github.com/PinnLabs/roadmap/issues/12",
      },
    ]);
  });
});
