# Roadmap

A public roadmap that tracks the status of PinnLabs projects — open source or
not — by reading from the GitHub API.

This repository currently contains the **communication API**: the server-side
layer that talks to GitHub and turns a repository into a small, stable status
snapshot. The UI comes later and will consume this API.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components) with Route Handlers
- TypeScript
- [Vitest](https://vitest.dev) for unit tests
- No runtime dependencies beyond Next.js/React — the GitHub client is built on the
  global `fetch`

## Getting started

```bash
npm install
cp .env.example .env.local   # then edit it
npm run dev
```

The API is then available at `http://localhost:3000/api/projects`.

```bash
curl "http://localhost:3000/api/projects"
curl "http://localhost:3000/api/projects?repo=owner/name"
```

## Configuration

Everything is read from the environment. Nothing about your repositories,
tokens, or endpoints is committed to this (public) repository.

| Variable                 | Required | Default                 | Description                                                                                   |
| ------------------------ | -------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`           | no       | _none_                  | GitHub token. Without it, requests are anonymous and limited to 60/hour per IP (5,000 with).  |
| `GITHUB_TRACKED_REPOS`   | no       | _empty_                 | Comma-separated allowlist of `owner/name`. This is the security boundary — see below.         |
| `GITHUB_API_BASE_URL`    | no       | `https://api.github.com` | API root. Set for GitHub Enterprise, e.g. `https://ghe.example.com/api/v3`.                    |
| `GITHUB_INCLUDE_PRIVATE` | no       | `false`                 | Whether private repositories may be exposed through this public API.                           |
| `GITHUB_ORGANIZATION`    | no       | owner of first tracked repo | Organization whose GitHub follower count is shown in the header (cached for 1 hour).  |

A misconfigured value fails loudly (`500 server_misconfigured`) rather than
silently shrinking the roadmap. Invalid entries are never echoed back.

## API

### `GET /api/projects`

Status for every tracked repository.

```json
{
  "projects": [
    {
      "repository": {
        "owner": "PinnLabs",
        "name": "roadmap",
        "fullName": "PinnLabs/roadmap",
        "description": "A public roadmap…",
        "url": "https://github.com/PinnLabs/roadmap",
        "homepage": null,
        "visibility": "public",
        "defaultBranch": "main",
        "archived": false,
        "stars": 12,
        "forks": 3,
        "createdAt": "2025-01-01T00:00:00Z",
        "pushedAt": "2026-01-02T03:04:05Z"
      },
      "issues": { "open": 5 },
      "pullRequests": { "open": 2 },
      "latestRelease": {
        "tag": "v1.2.0",
        "name": "Roadmap 1.2.0",
        "url": "https://github.com/PinnLabs/roadmap/releases/tag/v1.2.0",
        "prerelease": false,
        "publishedAt": "2026-02-01T00:00:00Z"
      },
      "latestCommit": {
        "sha": "abc123",
        "message": "feat: add project status endpoint",
        "url": "https://github.com/PinnLabs/roadmap/commit/abc123",
        "authorLogin": "felipecastro",
        "committedAt": "2026-03-01T10:00:00Z"
      },
      "fetchedAt": "2026-06-01T12:00:00.000Z"
    }
  ],
  "errors": [{ "repository": "PinnLabs/PinnStatus", "error": "not_found" }]
}
```

A repository that cannot be read lands in `errors` instead of failing the whole
request, so one broken repository never blanks the roadmap. `latestRelease` and
`latestCommit` are `null` when the repository has no releases, or is empty.

### `GET /api/projects?repo=owner/name`

Status for a single tracked repository, as `{ "project": { … } }`.

### Error responses

Error bodies are always `{ "error": "<code>" }`. Upstream messages, tokens and
stack traces are never returned.

| Status | Code                   | Meaning                                              |
| ------ | ---------------------- | ---------------------------------------------------- |
| 400    | `invalid_repository`   | `repo` is not a well-formed `owner/name` slug        |
| 404    | `not_found`            | Not in the allowlist, or absent/unavailable upstream |
| 429    | `rate_limited`         | GitHub rate limit hit; `Retry-After` is set          |
| 500    | `server_misconfigured` | Invalid environment configuration                    |
| 500    | `internal_error`       | Unexpected server failure                            |
| 502    | `upstream_unauthorized`| GitHub rejected our credentials                      |
| 502    | `upstream_unavailable` | Could not reach GitHub                               |
| 502    | `upstream_error`       | GitHub returned an unexpected response               |
| 504    | `upstream_timeout`     | GitHub did not answer within the timeout             |

## Architecture

Responsibilities are separated so the GitHub integration can be tested without a
network, a Next.js runtime, or a database.

```
app/api/projects/route.ts   Thin adapter: opts out of prerendering, wires config + client
lib/roadmap/http.ts         Framework-free request handler (routing, authz, error mapping)
lib/roadmap/status.ts       Data access layer: composes a ProjectStatus from several calls
lib/roadmap/config.ts       Server-only, validated environment configuration
lib/roadmap/types.ts        The public, stable response contract
lib/github/client.ts        GitHub REST client over fetch (no dependencies, injectable)
lib/repository-slug.ts      Strict owner/name parsing and allowlist matching
```

The layering only points one way: `route → http → status → github client`. The
GitHub client is a pure function of its options and never reads the environment;
`config.ts` and `status.ts` are marked `server-only`, so the build fails if they
are ever imported into a Client Component.

All I/O is asynchronous and independent calls are issued concurrently — a status
snapshot costs one round trip, not five.

## Testing

This API was built test-first. Tests inject a fake `fetch` and a fake GitHub
client, so the suite is fast, deterministic, and never touches the network.

```bash
npm test           # single run
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

## Security notes

Because this repository is public and the API is publicly reachable:

- **No secrets or repositories in source.** Everything is environment-driven.
  `.env*` files are git-ignored; only `.env.example` is committed.
- **The allowlist is the boundary.** `?repo=` is validated as a strict
  `owner/name` slug and must match `GITHUB_TRACKED_REPOS`; anything else returns
  `404`, so the endpoint cannot be used to probe arbitrary repositories. An empty
  allowlist tracks nothing.
- **Private repositories are hidden by default** and only exposed when
  `GITHUB_INCLUDE_PRIVATE=true`. Unknown visibility metadata fails safe to private.
- **Tokens never leak.** Error messages, responses, and logs are built from
  coarse, stable codes; any token appearing in an upstream message is redacted.
- **Defensive defaults.** Requests carry a timeout, responses are
  `Cache-Control: no-store` with `X-Content-Type-Options: nosniff`, and no
  permissive CORS headers are added.
- **Least privilege.** Use a read-only, fine-grained token scoped to the tracked
  repositories.

### Dependencies

`npm audit` reports five high-severity advisories that all trace back to a single
transitive dependency of `eslint-config-next` (`braces`). The installed `braces`
is already the latest release and is flagged with a wildcard version range, so no
patched version exists; npm's suggested "fix" is a downgrade that would break
Next.js 16. This is a dev-only, lint-time dependency and does not affect the
shipped API.

## Roadmap

- [x] GitHub communication API with tests
- [ ] Caching layer to protect the GitHub rate limit
- [ ] UI that renders the roadmap
- [ ] Milestones, issues grouped by label, and progress metrics
