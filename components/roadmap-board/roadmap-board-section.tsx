import { Suspense } from "react";

import { getPublicRoadmapItems } from "@/lib/roadmap/public-board";

import { RoadmapBoard, RoadmapBoardSkeleton } from "./roadmap-board";

async function RoadmapBoardData() {
  const items = await getPublicRoadmapItems();

  return <RoadmapBoard items={items} />;
}

export function RoadmapBoardSection() {
  return (
    <section aria-labelledby="roadmap-board-title" className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 id="roadmap-board-title" className="text-lg font-semibold tracking-tight text-primary dark:text-foreground">
          Roadmap board
        </h2>
        <p className="text-sm text-foreground/60">
          Live from GitHub issues and pull requests. Closed work stays in Shipped for 30 days.
        </p>
      </div>

      <Suspense fallback={<RoadmapBoardSkeleton />}>
        <RoadmapBoardData />
      </Suspense>
    </section>
  );
}
