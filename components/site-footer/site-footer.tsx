import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

import { RFCS_HREF } from "@/components/roadmap-hero/hero-actions";

import { SyncIndicator } from "./sync-indicator";

const FOOTER_LINKS = [
  { href: RFCS_HREF, label: "Architecture RFCs" },
  { href: "/contributing", label: "Contributing Guide" },
  { href: "/security", label: "Security Policy" },
  { href: "/license", label: "License" },
] as const;

async function Copyright() {
  "use cache";
  cacheLife("days");

  return (
    <p className="font-mono text-xs text-foreground/60">
      © {new Date().getFullYear()} PinnLabs Roadmap. Open governance.
    </p>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-foreground/10 bg-background">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <Suspense
          fallback={<span aria-hidden="true" className="h-5 w-64 animate-pulse rounded bg-foreground/5" />}
        >
          <SyncIndicator />
        </Suspense>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded text-sm font-medium text-foreground/80 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Copyright />
      </div>
    </footer>
  );
}
