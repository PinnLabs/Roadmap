"use client";

import { useEffect, useState } from "react";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function format(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);

  if (Math.abs(minutes) < 1) {
    return "just now";
  }

  if (Math.abs(minutes) < 60) {
    return relative.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);
  return Math.abs(hours) < 24 ? relative.format(hours, "hour") : relative.format(Math.round(hours / 24), "day");
}

/**
 * "4 minutes ago", ticking every minute. The server can't know when the page is
 * read (it may be served from cache), so the label is computed on the client.
 */
export function RelativeTime({ iso }: { readonly iso: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()}>
      {now === null ? "recently" : format(iso, now)}
    </time>
  );
}
