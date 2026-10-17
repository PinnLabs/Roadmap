import { describe, expect, it, vi } from "vitest";

import { handleNewsletterSubscribe } from "./http";

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleNewsletterSubscribe", () => {
  it("rejects invalid emails and missing consent without calling Resend", async () => {
    const fetcher = vi.fn<typeof fetch>();

    const invalidEmail = await handleNewsletterSubscribe(
      createRequest({ email: "not-an-email", consent: true }),
      { env: { RESEND_API_KEY: "secret" }, fetcher },
    );
    const missingConsent = await handleNewsletterSubscribe(
      createRequest({ email: "reader@example.com", consent: false }),
      { env: { RESEND_API_KEY: "secret" }, fetcher },
    );

    expect(invalidEmail.status).toBe(400);
    expect(await invalidEmail.json()).toEqual({ error: "invalid_email" });
    expect(missingConsent.status).toBe(400);
    expect(await missingConsent.json()).toEqual({ error: "consent_required" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires a Resend API key", async () => {
    const response = await handleNewsletterSubscribe(
      createRequest({ email: "reader@example.com", consent: true }),
      { env: {} },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server_misconfigured" });
  });

  it("creates a subscribed Resend contact using the environment key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 201 }));
    const response = await handleNewsletterSubscribe(
      createRequest({ email: " Reader@Example.com ", consent: true }),
      { env: { RESEND_API_KEY: "  test-key  " }, fetcher },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/contacts", {
      method: "POST",
      headers: {
        authorization: "Bearer test-key",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "reader@example.com", unsubscribed: false }),
    });
  });

  it("returns success when the contact already exists", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 409 }));
    const response = await handleNewsletterSubscribe(
      createRequest({ email: "reader@example.com", consent: true }),
      { env: { RESEND_API_KEY: "test-key" }, fetcher },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("does not expose Resend errors to the caller", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive details", { status: 500 }));
    const response = await handleNewsletterSubscribe(
      createRequest({ email: "reader@example.com", consent: true }),
      { env: { RESEND_API_KEY: "test-key" }, fetcher },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_error" });
  });

  it("rejects malformed JSON", async () => {
    const response = await handleNewsletterSubscribe(
      new Request("http://localhost/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      { env: { RESEND_API_KEY: "test-key" } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  it("rejects non-object JSON payloads", async () => {
    const response = await handleNewsletterSubscribe(
      new Request("http://localhost/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(["reader@example.com"]),
      }),
      { env: { RESEND_API_KEY: "test-key" } },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  it("maps Resend network failures to an upstream unavailable error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    const response = await handleNewsletterSubscribe(
      createRequest({ email: "reader@example.com", consent: true }),
      { env: { RESEND_API_KEY: "test-key" }, fetcher },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
