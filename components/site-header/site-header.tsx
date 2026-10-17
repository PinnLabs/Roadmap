import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { FollowersBadge, FollowersBadgeSkeleton } from "./followers-badge";
import { BellIcon, RssIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { NAV_LINKS, RSS_HREF, SUBSCRIBE_HREF } from "./nav-links";
import { SearchField } from "./search-field";

function Followers() {
  return (
    <Suspense fallback={<FollowersBadgeSkeleton />}>
      <FollowersBadge />
    </Suspense>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="relative mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:gap-6 xl:h-20">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Image
            src="/images/icon-192.png"
            alt=""
            width={40}
            height={40}
            priority
            className="size-9 rounded-lg xl:size-10"
          />
          <span className="text-lg font-semibold tracking-tight text-foreground">
            PinnLabs<span className="text-secondary dark:text-foreground/70">Roadmap</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 xl:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block max-w-32 rounded-lg px-3 py-1.5 text-sm font-medium leading-tight text-foreground/80 transition-colors hover:bg-primary/5 hover:text-primary 2xl:max-w-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchField id="site-search" shortcut className="hidden w-48 md:block lg:w-56" />

          <div className="hidden sm:block">
            <Followers />
          </div>

          <a
            href={RSS_HREF}
            aria-label="RSS feed"
            className="hidden size-10 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground sm:inline-flex"
          >
            <RssIcon className="size-5" />
          </a>

          <Link
            href={SUBSCRIBE_HREF}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
          >
            <BellIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">Subscribe</span>
          </Link>

          <MobileMenu followers={<Followers />} />
        </div>
      </div>
    </header>
  );
}
