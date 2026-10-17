<p align="center">
  <img src="public/images/icon-512.png" alt="PinnLabs logo" width="120" height="120" />
</p>

<h1 align="center">PinnLabs Roadmap</h1>

<p align="center">
  A public transparency portal for PinnLabs projects, built live from GitHub.
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#api">API</a>
</p>

---

PinnLabs Roadmap shows what our maintainers are researching, building and
shipping across our repositories, with no hidden backlog. Nothing is entered by
hand: every number, card and status comes from public GitHub data (issues, pull
requests, releases and commits), so the roadmap stays accurate as long as the
work happens on GitHub.

## Features

- **Roadmap board.** A Kanban of issues and pull requests, grouped into
  *Backlog → In progress → In review → Shipped* and inferred from GitHub
  activity.
- **Project explorer.** Filter by project (all projects by default), search
  repositories, releases and commits, and see totals for open issues, open pull
  requests, stars and forks. The filter and search are stored in the URL, so a
  view can be shared as a link.
- **Organization header.** Shows the GitHub organization's follower count, with
  search and navigation. Mobile first.
- **Sync status footer.** Shows whether the GitHub sync is healthy and when it
  last ran.
- **JSON API.** `GET /api/projects` exposes the same status snapshots for other
  tools to use.

## How it works

```
               ┌──────────────────────────────┐
  GitHub REST  │ lib/github/client.ts         │  typed, dependency-free client
  API  ───────▶│  repos · issues · releases   │  (timeouts, error mapping,
               │  commits · search · orgs     │   token redaction)
               └──────────────┬───────────────┘
                              │
               ┌──────────────▼───────────────┐
               │ lib/roadmap/*                │  domain layer: allowlist, status
               │  status · board · filters    │  snapshots, stage inference,
               │  sync status · config        │  filtering (pure, unit-tested)
               └───────┬──────────────┬───────┘
                       │              │
        "use cache" loaders      Route Handler
        (minutes / hours)        app/api/projects
                       │              │
               ┌───────▼──────┐   ┌───▼──────────┐
               │ Server pages │   │ JSON API     │
               │ header, hero,│   │ (no-store)   │
               │ board, footer│   └──────────────┘
               └──────────────┘
```

1. **Allowlist.** Only the repositories listed in `GITHUB_TRACKED_REPOS` are
   ever read. The public pages show **public** repositories only.
2. **Fetch.** The GitHub client issues independent requests concurrently, so
   one repository's snapshot is one round trip.
3. **Cache.** Page data is wrapped in Next.js Cache Components (`"use cache"`):
   project status and the board refresh every minute and follower counts every
   hour. Visitors are served from the cache, so they never spend the GitHub
   rate limit.
4. **Derive.** Pure functions turn raw issues into board stages and priorities,
   and project statuses into totals and sync health.
5. **Render.** Server Components stream each section inside `<Suspense>`. A
   repository that fails is skipped instead of blanking the page.

### How issues map to the board

| GitHub state                                             | Column      |
| -------------------------------------------------------- | ----------- |
| Open issue, no assignee                                  | Backlog     |
| Open issue with an assignee, or an `in progress`/`wip` label | In progress |
| Open pull request                                        | In review   |
| Closed issue or merged PR, in the last 30 days           | Shipped     |

Closed pull requests that were never merged are left off the board.

Priority is read from labels: `critical`/`urgent`/`p0` → Urgent,
`high`/`p1` → High, `medium`/`normal`/`p2` → Normal, `low`/`p3` → Low.
Cards are sorted by priority first, then by most recently updated. When an
issue belongs to a milestone, its card shows the milestone, its due date and
its progress (closed issues ÷ total).

The board is **read-only**: to move a card, change the issue on GitHub. The
`KanbanBoard` component in `components/ui` also supports drag and drop
(pointer and keyboard) for boards that are not driven by GitHub.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components, Route Handlers)
- React 19 and TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4, using the global palette tokens in
  `app/globals.css` (`primary`, `secondary`, `neutral`)
- [Framer Motion](https://motion.dev) and [Lucide](https://lucide.dev) for the board
- [Vitest](https://vitest.dev) for unit tests
- The GitHub client has no dependencies. It uses the global `fetch`.

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

Responsibilities are separated so the GitHub integration and the roadmap logic
can be tested without a network, a Next.js runtime or a browser.

```
app/
  layout.tsx                  Site shell: header, page, footer
  page.tsx                    Home: hero + roadmap board
  icon.png, apple-icon.png    Favicons (Next.js file conventions)
  api/projects/route.ts       Thin adapter: opts out of prerendering, wires config + client

components/
  site-header/                Header, mobile menu, ⌘K search, follower badge
  roadmap-hero/               Hero, actions, project filter + search explorer
  roadmap-board/              Maps roadmap items onto the Kanban board
  site-footer/                Sync status, links, copyright
  ui/kanban-board.tsx         Generic, accessible Kanban component (shadcn-style)

lib/
  github/client.ts            GitHub REST client over fetch (no dependencies, injectable)
  roadmap/config.ts           Server-only, validated environment configuration
  roadmap/http.ts             Framework-free API request handler (authz, error mapping)
  roadmap/status.ts           Composes a ProjectStatus from several GitHub calls
  roadmap/board.ts            Stage and priority inference, grouping, filtering
  roadmap/project-filter.ts   Project selection, search and totals
  roadmap/sync-status.ts      Sync health for the footer
  roadmap/public-*.ts         Cached ("use cache") loaders used by the pages
  roadmap/organization.ts     Cached organization follower count
  repository-slug.ts          Strict owner/name parsing and allowlist matching
```

Dependencies only point one way: `pages/route → loaders/http → domain →
github client`. The GitHub client takes everything as options and never reads
the environment. Loaders and config are marked `server-only`, so the build fails
if they are imported into a Client Component.

## Testing

The domain and API layers were built test-first. Tests inject a fake `fetch` and a fake GitHub
client, so the suite is fast, deterministic, and never touches the network.

```bash
npm test           # single run
npm run test:watch # watch mode
npm run typecheck  # next typegen && tsc --noEmit
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
- **Private repositories are hidden by default.** The API only exposes them when
  `GITHUB_INCLUDE_PRIVATE=true`, and the public pages never show them.
  When visibility metadata is unknown, the repository is treated as private.
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
- [x] Caching layer to protect the GitHub rate limit
- [x] Header, hero with project explorer, and footer
- [x] Kanban board driven by issues and pull requests
- [ ] Releases & changelog, community wishlist and repository health pages
- [ ] Search page, RSS feed and email subscriptions
- [ ] Architecture RFCs
