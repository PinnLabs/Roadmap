import type { Metadata } from "next";

import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = {
  title: "Subscribe | PinnLabs Roadmap",
  description: "Get email updates when PinnLabs roadmap work changes.",
};

export default function SubscribePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-1 border-b border-foreground/10 bg-linear-to-br from-background via-background to-primary/5">
        <div className="mx-auto grid w-full max-w-screen-2xl content-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:gap-16 lg:py-24">
          <div className="flex max-w-3xl flex-col items-start gap-5">
            <p className="font-mono text-xs uppercase text-foreground/60">
              PinnLabs / Roadmap
            </p>
            <h1 className="text-3xl font-bold text-primary sm:text-4xl dark:text-foreground">
              Roadmap updates, in your inbox.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-foreground/70">
              Get an email when there is meaningful progress across PinnLabs
              projects. No noise, just updates from the public roadmap.
            </p>
          </div>

          <div className="border-l-2 border-primary/20 pl-5 lg:pl-8">
            <SubscribeForm />
          </div>
        </div>
      </section>
    </main>
  );
}