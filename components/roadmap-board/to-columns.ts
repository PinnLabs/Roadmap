import type { KanbanColumn, KanbanTask } from "@/components/ui/kanban-board";
import { groupByStage, type RoadmapItem, type RoadmapStage } from "@/lib/roadmap/board";

const STAGE_COLUMNS: ReadonlyArray<{
  stage: RoadmapStage;
  name: string;
  accent: KanbanColumn["accent"];
}> = [
  { stage: "backlog", name: "Backlog", accent: "muted" },
  { stage: "in_progress", name: "In progress", accent: "soft" },
  { stage: "in_review", name: "In review", accent: "secondary" },
  { stage: "shipped", name: "Shipped", accent: "primary" },
];

/** Milestones due within this many days (or overdue) are emphasised. */
const DUE_SOON_DAYS = 7;

const dueFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function toTask(item: RoadmapItem, now: Date): KanbanTask {
  const comments =
    item.comments > 0 ? ` · ${item.comments} comment${item.comments === 1 ? "" : "s"}` : "";
  const dueOn = item.milestone?.dueOn ? Date.parse(item.milestone.dueOn) : NaN;
  const hasDue = Number.isFinite(dueOn);

  return {
    id: item.id,
    title: item.title,
    note: `#${item.number}${item.milestone ? ` · ${item.milestone.title}` : ""}${comments}`,
    priority: item.priority ?? undefined,
    category: item.repository.split("/")[1] ?? item.repository,
    icon: item.kind === "pull_request" ? "pull-request" : "issue",
    assignees: item.assignees.map((assignee) => ({
      name: assignee.login,
      avatar: assignee.avatarUrl ?? undefined,
    })),
    due: hasDue ? dueFormat.format(dueOn) : undefined,
    dueSoon:
      hasDue &&
      item.stage !== "shipped" &&
      dueOn - now.getTime() <= DUE_SOON_DAYS * 86_400_000,
    progress: item.milestone ? item.milestone.progress : undefined,
    href: item.url,
  };
}

export function toKanbanColumns(
  items: readonly RoadmapItem[],
  now: Date = new Date(),
): KanbanColumn[] {
  const groups = groupByStage(items);

  return STAGE_COLUMNS.map(({ stage, name, accent }) => ({
    id: stage,
    name,
    accent,
    tasks: groups[stage].map((item) => toTask(item, now)),
  }));
}
