"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { KanbanBoard } from "@/components/ui/kanban-board";
import { filterRoadmapItems, type RoadmapItem } from "@/lib/roadmap/board";
import { ALL_PROJECTS } from "@/lib/roadmap/project-filter";

import { toKanbanColumns } from "./to-columns";

interface RoadmapBoardProps {
  readonly items: readonly RoadmapItem[];
}

/**
 * Read-only Kanban of public issues and pull requests. Follows the hero's
 * project filter and search (`?project=` and `?q=`) so both stay in sync.
 */
export function RoadmapBoard({ items }: RoadmapBoardProps) {
  const searchParams = useSearchParams();
  const project = searchParams.get("project") ?? ALL_PROJECTS;
  const query = searchParams.get("q") ?? "";

  const columns = useMemo(
    () => toKanbanColumns(filterRoadmapItems(items, { project, query })),
    [items, project, query],
  );

  return (
    <KanbanBoard
      columns={columns}
      readOnly
      label="Public roadmap board"
      emptyLabel="No items in this stage"
    />
  );
}

export function RoadmapBoardSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-80 w-[286px] shrink-0 animate-pulse rounded-2xl bg-foreground/[0.04]" />
      ))}
    </div>
  );
}
