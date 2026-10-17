import { RoadmapHeroActions } from "./hero-actions";

export function RoadmapHero() {
  return (
    <section
      aria-labelledby="roadmap-hero-title"
      className="border-b border-foreground/10 bg-linear-to-br from-background via-background to-primary/5"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs uppercase text-foreground/70">
            <span className="rounded bg-foreground/5 px-1.5 py-0.5">PinnLabs-public</span>
            <span aria-hidden="true">/</span>
            <span>Roadmap-index-2026</span>
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary dark:bg-foreground/10 dark:text-foreground">
              Live synced
            </span>
          </p>

          <h1
            id="roadmap-hero-title"
            className="text-3xl font-bold tracking-tight text-primary sm:text-4xl dark:text-foreground"
          >
            Public Product &amp; Engineering Roadmap
          </h1>

          <p className="max-w-3xl text-sm leading-relaxed text-foreground/70 sm:text-base">
            Transparent, real-time status of what our maintainers are researching,
            actively architecting, and shipping across open repositories. Built on
            community RFCs and zero hidden backlogs.
          </p>
        </div>

        <RoadmapHeroActions />
      </div>
    </section>
  );
}
