import { RoadmapBoardSection } from "@/components/roadmap-board";
import { RoadmapHero } from "@/components/roadmap-hero";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <RoadmapHero />
      <RoadmapBoardSection />
    </main>
  );
}
