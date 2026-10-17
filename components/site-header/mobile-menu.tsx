"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

import { CloseIcon, MenuIcon, RssIcon } from "./icons";
import { NAV_LINKS, RSS_HREF } from "./nav-links";
import { SearchField } from "./search-field";

interface MobileMenuProps {
  /** Server-rendered followers badge, streamed into the panel. */
  readonly followers: ReactNode;
}

export function MobileMenu({ followers }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {open ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-foreground/10 bg-background shadow-lg"
      >
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:px-6">
          <SearchField id={`${panelId}-search`} className="md:hidden" />

          <nav aria-label="Primary">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-4 sm:hidden">
            {followers}
            <a
              href={RSS_HREF}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              <RssIcon className="size-4" />
              RSS feed
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
