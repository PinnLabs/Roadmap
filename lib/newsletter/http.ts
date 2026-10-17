import "server-only";

export interface NewsletterHandlerDependencies {
  readonly env: Record<string, string | undefined>;
  readonly fetcher?: typeof fetch;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function handleNewsletterSubscribe(
  request: Request,
  dependencies: NewsletterHandlerDependencies,
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (!isRecord(body)) {
    return json({ error: "invalid_request" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return json({ error: "invalid_email" }, 400);
  }

  if (body.consent !== true) {
    return json({ error: "consent_required" }, 400);
  }

  const apiKey = dependencies.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return json({ error: "server_misconfigured" }, 500);
  }

  let response: Response;

  try {
    response = await (dependencies.fetcher ?? fetch)("https://api.resend.com/contacts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
  } catch {
    return json({ error: "upstream_unavailable" }, 502);
  }

  if (response.ok || response.status === 409) {
    return json({ ok: true }, 200);
  }

  return json({ error: "upstream_error" }, 502);
}