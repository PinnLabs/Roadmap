import { getOrganizationSummary } from "@/lib/roadmap/organization";

import { UsersIcon } from "./icons";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const full = new Intl.NumberFormat("en");

export async function FollowersBadge() {
  const organization = await getOrganizationSummary();

  if (!organization) {
    return null;
  }

  return (
    <a
      href={organization.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${full.format(organization.followers)} followers of ${organization.login} on GitHub`}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <UsersIcon className="size-4" />
      <span>Followers</span>
      <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 font-mono text-xs tabular-nums">
        {compact.format(organization.followers).toLowerCase()}
      </span>
    </a>
  );
}

export function FollowersBadgeSkeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-10 w-36 shrink-0 animate-pulse rounded-lg bg-foreground/5"
    />
  );
}
