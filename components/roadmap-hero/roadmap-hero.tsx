import Link from "next/link";

import { BellIcon, RssIcon } from "@/components/site-header/icons";
import { RSS_HREF, SUBSCRIBE_HREF } from "@/components/site-header/nav-links";

import { BookIcon, ChevronDownIcon, PlusCircleIcon } from "./icons";

export const RFCS_HREF = "/rfcs";
export const PROPOSE_HREF = "/rfcs/new";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

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

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap">
          <details className="group relative">
            <summary
              className={`flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-foreground/10 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              <BellIcon className="size-4" />
              Roadmap Alerts
              <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="absolute right-0 z-30 mt-2 w-full min-w-48 rounded-lg border border-foreground/10 bg-background p-1 shadow-lg sm:w-auto">
              <li>
                <Link
                  href={SUBSCRIBE_HREF}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-primary/5 hover:text-primary"
                >
                  <BellIcon className="size-4" />
                  Email alerts
                </Link>
              </li>
              <li>
                <a
                  href={RSS_HREF}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-primary/5 hover:text-primary"
                >
                  <RssIcon className="size-4" />
                  RSS feed
                </a>
              </li>
            </ul>
          </details>

          <Link
            href={RFCS_HREF}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground/10 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/15 ${focusRing}`}
          >
            <BookIcon className="size-4" />
            View Architecture RFCs
          </Link>

          <Link
            href={PROPOSE_HREF}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-secondary ${focusRing}`}
          >
            <PlusCircleIcon className="size-4" />
            Propose RFC / Feature
          </Link>
        </div>
      </div>
    </section>
  );
}
