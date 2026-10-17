import type { ProjectStatus } from "./types";

export type SyncHealth = "operational" | "degraded" | "unavailable";

export interface SyncStatus {
  readonly health: SyncHealth;
  /** Most recent `fetchedAt` across the loaded projects, if any loaded. */
  readonly updatedAt: string | null;
}

/** Summarises how healthy the GitHub sync behind the public pages is. */
export function getSyncStatus(
  projects: readonly ProjectStatus[],
  failed: number,
): SyncStatus {
  const updatedAt = projects.reduce<string | null>(
    (latest, project) =>
      latest === null || Date.parse(project.fetchedAt) > Date.parse(latest)
        ? project.fetchedAt
        : latest,
    null,
  );

  const health: SyncHealth =
    projects.length === 0 ? "unavailable" : failed > 0 ? "degraded" : "operational";

  return { health, updatedAt };
}
