import { describe, expect, it } from "vitest";

import { getSyncStatus } from "./sync-status";
import type { ProjectStatus } from "./types";

function project(fetchedAt: string): ProjectStatus {
  return { fetchedAt } as ProjectStatus;
}

describe("getSyncStatus", () => {
  it("is operational when every repository loaded", () => {
    expect(
      getSyncStatus([project("2026-10-17T10:00:00Z"), project("2026-10-17T10:05:00Z")], 0),
    ).toEqual({ health: "operational", updatedAt: "2026-10-17T10:05:00Z" });
  });

  it("is degraded when some repositories failed", () => {
    expect(getSyncStatus([project("2026-10-17T10:00:00Z")], 1).health).toBe("degraded");
  });

  it("is unavailable when nothing loaded", () => {
    expect(getSyncStatus([], 2)).toEqual({ health: "unavailable", updatedAt: null });
  });
});
