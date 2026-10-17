"use client";

import { useEffect, useRef } from "react";

import { SearchIcon } from "./icons";

interface SearchFieldProps {
  readonly id: string;
  /** Only one field should own the global ⌘K / Ctrl+K shortcut. */
  readonly shortcut?: boolean;
  readonly className?: string;
}

export function SearchField({ id, shortcut = false, className = "" }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  return (
    <form action="/search" role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Search issues
      </label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        placeholder="Search issues…"
        autoComplete="off"
        className="h-10 w-full rounded-lg bg-foreground/5 pl-9 pr-12 text-sm text-foreground placeholder:text-foreground/50 outline-none transition-colors focus:bg-background focus:ring-2 focus:ring-primary/40"
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-foreground/10 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground/60">
          ⌘K
        </kbd>
      ) : null}
    </form>
  );
}
