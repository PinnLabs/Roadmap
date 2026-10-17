/**
 * `GET /api/health` — liveness probe for the container.
 *
 * Deliberately touches nothing upstream: a health check that called GitHub
 * would spend the rate limit and mark the app unhealthy whenever GitHub is.
 */
export function GET(): Response {
  return Response.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
}
