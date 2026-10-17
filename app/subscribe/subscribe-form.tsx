"use client";

import { useState, type FormEvent } from "react";

import { BellIcon } from "@/components/site-header/icons";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function SubscribeForm() {
  const [status, setStatus] = useState<FormStatus>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          consent: formData.has("consent"),
        }),
      });

      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="newsletter-email" className="text-sm font-semibold text-foreground">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="h-11 rounded-md border border-foreground/20 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground/70">
        <input
          name="consent"
          type="checkbox"
          required
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>I agree to receive email updates about the PinnLabs roadmap.</span>
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70"
      >
        <BellIcon className="size-4" />
        {status === "submitting" ? "Subscribing…" : "Subscribe to updates"}
      </button>

      <p aria-live="polite" className="min-h-5 text-sm text-foreground/70">
        {status === "success" && "You're on the list. Watch your inbox for roadmap updates."}
        {status === "error" && "We couldn't complete your subscription. Please try again."}
      </p>
    </form>
  );
}