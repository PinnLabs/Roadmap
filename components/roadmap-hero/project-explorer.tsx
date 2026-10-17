"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SearchIcon } from "@/components/site-header/icons";
import {
  ALL_PROJECTS,
  filterProjects,
  resolveProject,
  summarizeProjects,
} from "@/lib/roadmap/project-filter";
import type { ProjectStatus } from "@/lib/roadmap/types";

import { ChevronDownIcon } from "./icons";

interface ProjectExplorerProps {
  readonly projects: readonly ProjectStatus[];
  readonly failed: number;
}

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatCount(value: number): string {
  return compact.format(value).toLowerCase();
}

function timeAgo(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  return Number.isNaN(days) ? null : relative.format(days, "day");
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function ProjectExplorer({ projects, failed }: ProjectExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const project = resolveProject(searchParams.get("project"), projects);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");

  const visible = useMemo(
    () => filterProjects(projects, { project, query }),
    [projects, project, query],
  );
  const summary = summarizeProjects(visible);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function updateUrl(next: { project?: string; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ALL_PROJECTS) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const stats = [
    { label: "Repositories", value: summary.repositories },
    { label: "Open issues", value: summary.openIssues },
    { label: "Open pull requests", value: summary.openPullRequests },
    { label: "Stars", value: summary.stars },
    { label: "Forks", value: summary.forks },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:w-56 sm:shrink-0">
          <label htmlFor="project-filter" className="sr-only">
            Project
          </label>
          <select
            id="project-filter"
            value={project}
            onChange={(event) => updateUrl({ project: event.target.value })}
            className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-foreground/10 bg-background pl-3 pr-9 text-sm font-medium text-foreground outline-none transition-colors hover:bg-foreground/5 focus:ring-2 focus:ring-primary/40"
          >
            <option value={ALL_PROJECTS}>All projects</option>
            {projects.map(({ repository }) => (
              <option key={repository.fullName} value={repository.fullName}>
                {repository.fullName}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground/60" />
        </div>

        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="relative flex-1"
        >
          <label htmlFor="project-search" className="sr-only">
            Search public repositories and status
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
          <input
            ref={inputRef}
            id="project-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              updateUrl({ q: event.target.value.trim() });
            }}
            placeholder="Search repositories, releases, commits…"
            autoComplete="off"
            className="h-10 w-full rounded-lg bg-foreground/5 pl-9 pr-10 text-sm text-foreground placeholder:text-foreground/50 outline-none transition-colors focus:bg-background focus:ring-2 focus:ring-primary/40"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-foreground/10 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground/60">
            /
          </kbd>
        </form>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-foreground/10 bg-background/70 px-3 py-2"
          >
            <dt className="text-xs text-foreground/60">{stat.label}</dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-primary dark:text-foreground">
              {formatCount(stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "repository" : "repositories"} shown
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 px-4 py-6 text-center text-sm text-foreground/60">
          {projects.length === 0
            ? "No public repositories are available right now."
            : "No repositories match this search."}
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((status) => (
            <ProjectCard key={status.repository.fullName} status={status} />
          ))}
        </ul>
      )}

      {failed > 0 ? (
        <p className="text-xs text-foreground/60">
          {failed} {failed === 1 ? "repository" : "repositories"} could not be loaded.
        </p>
      ) : null}
    </div>
  );
}

function ProjectCard({ status }: { readonly status: ProjectStatus }) {
  const { repository, issues, pullRequests, latestRelease, latestCommit } = status;
  const committed = timeAgo(latestCommit?.committedAt ?? null);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <a
          href={repository.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 truncate font-mono text-sm font-semibold text-primary hover:underline dark:text-foreground"
        >
          {repository.fullName}
        </a>
        {latestRelease ? (
          <a
            href={latestRelease.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary dark:bg-foreground/10 dark:text-foreground"
          >
            {latestRelease.tag}
          </a>
        ) : null}
      </div>

      {repository.description ? (
        <p className="line-clamp-2 text-xs text-foreground/70">{repository.description}</p>
      ) : null}

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/70">
        <span>
          <strong className="font-semibold text-foreground">{formatCount(issues.open)}</strong>{" "}
          open issues
        </span>
        <span>
          <strong className="font-semibold text-foreground">
            {formatCount(pullRequests.open)}
          </strong>{" "}
          open PRs
        </span>
        <span>
          <strong className="font-semibold text-foreground">
            {formatCount(repository.stars)}
          </strong>{" "}
          stars
        </span>
      </p>

      {latestCommit ? (
        <a
          href={latestCommit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-foreground/60 hover:text-foreground"
        >
          {latestCommit.message}
          {committed ? ` · ${committed}` : ""}
        </a>
      ) : null}
    </li>
  );
}

export function ProjectExplorerSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <span className="h-10 animate-pulse rounded-lg bg-foreground/5 sm:w-56" />
        <span className="h-10 flex-1 animate-pulse rounded-lg bg-foreground/5" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="h-14 animate-pulse rounded-lg bg-foreground/5" />
        ))}
      </div>
    </div>
  );
}
