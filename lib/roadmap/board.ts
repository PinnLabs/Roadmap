import type { GitHubIssue } from "@/lib/github/types";

import { ALL_PROJECTS } from "./project-filter";

/**
 * Turns GitHub issues and pull requests into roadmap items grouped by stage.
 *
 * The stage is inferred from public signals only — state, assignees, labels and
 * whether the item is a pull request — so maintainers do not need any extra
 * tooling for the board to stay accurate.
 */

export const ROADMAP_STAGES = ["backlog", "in_progress", "in_review", "shipped"] as const;
export type RoadmapStage = (typeof ROADMAP_STAGES)[number];

export type RoadmapPriority = "urgent" | "high" | "normal" | "low";

export interface RoadmapItem {
  /** Stable across repositories, e.g. `PinnLabs/roadmap#12`. */
  readonly id: string;
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly kind: "issue" | "pull_request";
  readonly stage: RoadmapStage;
  readonly priority: RoadmapPriority | null;
  readonly labels: readonly string[];
  readonly assignees: readonly { readonly login: string; readonly avatarUrl: string | null }[];
  readonly milestone: {
    readonly title: string;
    readonly dueOn: string | null;
    /** 0–100, from the milestone's closed/total issue ratio. */
    readonly progress: number;
  } | null;
  readonly comments: number;
  readonly updatedAt: string | null;
}

/** Closed work older than this drops off the "Shipped" column. */
export const SHIPPED_WINDOW_DAYS = 30;

const IN_PROGRESS_LABEL = /\b(in[\s_-]?progress|doing|wip|working)\b/i;

const PRIORITY_PATTERNS: ReadonlyArray<[RoadmapPriority, RegExp]> = [
  ["urgent", /\b(urgent|critical|blocker|p0)\b/i],
  ["high", /\b(high|p1)\b/i],
  ["normal", /\b(medium|normal|p2)\b/i],
  ["low", /\b(low|p3|minor)\b/i],
];

const PRIORITY_RANK: Record<RoadmapPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function priorityFromLabels(labels: readonly string[]): RoadmapPriority | null {
  for (const [priority, pattern] of PRIORITY_PATTERNS) {
    if (labels.some((label) => pattern.test(label))) {
      return priority;
    }
  }

  return null;
}

function stageOf(issue: GitHubIssue, now: Date): RoadmapStage | null {
  if (issue.state === "closed") {
    // A closed, unmerged pull request was abandoned: it never shipped.
    if (issue.isPullRequest && !issue.mergedAt) {
      return null;
    }

    const closedAt = Date.parse(issue.mergedAt ?? issue.closedAt ?? "");
    const ageDays = (now.getTime() - closedAt) / 86_400_000;

    return Number.isFinite(ageDays) && ageDays <= SHIPPED_WINDOW_DAYS ? "shipped" : null;
  }

  if (issue.isPullRequest) {
    return "in_review";
  }

  if (issue.assignees.length > 0 || issue.labels.some((label) => IN_PROGRESS_LABEL.test(label))) {
    return "in_progress";
  }

  return "backlog";
}

function milestoneProgress(issue: GitHubIssue): RoadmapItem["milestone"] {
  if (!issue.milestone) {
    return null;
  }

  const { openIssues, closedIssues } = issue.milestone;
  const total = openIssues + closedIssues;

  return {
    title: issue.milestone.title,
    dueOn: issue.milestone.dueOn,
    progress: total === 0 ? 0 : Math.round((closedIssues / total) * 100),
  };
}

export function toRoadmapItems(
  repository: string,
  issues: readonly GitHubIssue[],
  now: Date = new Date(),
): RoadmapItem[] {
  const items: RoadmapItem[] = [];

  for (const issue of issues) {
    const stage = stageOf(issue, now);

    if (!stage) {
      continue;
    }

    items.push({
      id: `${repository}#${issue.number}`,
      repository,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      kind: issue.isPullRequest ? "pull_request" : "issue",
      stage,
      priority: priorityFromLabels(issue.labels),
      labels: issue.labels,
      assignees: issue.assignees,
      milestone: milestoneProgress(issue),
      comments: issue.comments,
      updatedAt: issue.updatedAt,
    });
  }

  return items;
}

/** Highest priority first, then most recently updated. */
export function compareRoadmapItems(a: RoadmapItem, b: RoadmapItem): number {
  const rank = (item: RoadmapItem) => (item.priority ? PRIORITY_RANK[item.priority] : 4);
  const byPriority = rank(a) - rank(b);

  if (byPriority !== 0) {
    return byPriority;
  }

  return Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? "") || 0;
}

export function groupByStage(
  items: readonly RoadmapItem[],
): Record<RoadmapStage, RoadmapItem[]> {
  const groups: Record<RoadmapStage, RoadmapItem[]> = {
    backlog: [],
    in_progress: [],
    in_review: [],
    shipped: [],
  };

  for (const item of items) {
    groups[item.stage].push(item);
  }

  for (const stage of ROADMAP_STAGES) {
    groups[stage].sort(compareRoadmapItems);
  }

  return groups;
}

export interface RoadmapItemFilter {
  /** `ALL_PROJECTS`, or a repository `fullName` (case-insensitive). */
  readonly project: string;
  /** Free text matched against title, labels, repository and `#number`. */
  readonly query: string;
}

export function filterRoadmapItems(
  items: readonly RoadmapItem[],
  filter: RoadmapItemFilter,
): RoadmapItem[] {
  const project = filter.project.toLowerCase();
  const terms = filter.query.toLowerCase().split(/\s+/).filter(Boolean);

  return items.filter((item) => {
    if (project !== ALL_PROJECTS && item.repository.toLowerCase() !== project) {
      return false;
    }

    const text = [item.title, item.repository, `#${item.number}`, ...item.labels]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => text.includes(term));
  });
}
