import { getPublicProjects } from "@/lib/roadmap/public-projects";
import { getSyncStatus, type SyncHealth } from "@/lib/roadmap/sync-status";

import { RelativeTime } from "./relative-time";

const HEALTH: Record<SyncHealth, { label: string; dot: string }> = {
  operational: { label: "All systems operational", dot: "bg-secondary dark:bg-foreground/80" },
  degraded: { label: "Partial GitHub sync", dot: "bg-secondary/50 dark:bg-foreground/50" },
  unavailable: { label: "GitHub sync unavailable", dot: "bg-foreground/30" },
};

export async function SyncIndicator() {
  const { projects, failed } = await getPublicProjects();
  const { health, updatedAt } = getSyncStatus(projects, failed);
  const { label, dot } = HEALTH[health];

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-2 font-mono font-semibold text-foreground">
        <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
        {label}
      </span>
      {updatedAt ? (
        <>
          <span aria-hidden="true" className="size-1 rounded-full bg-foreground/25" />
          <span className="text-foreground/60">
            Updated <RelativeTime iso={updatedAt} /> via GitHub Sync
          </span>
        </>
      ) : null}
    </p>
  );
}
