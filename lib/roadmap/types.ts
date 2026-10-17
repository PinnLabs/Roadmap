/**
 * The public, stable contract served by the roadmap API.
 *
 * These types are owned by the domain layer rather than re-using the GitHub
 * client's types. A change in an upstream payload then cannot silently reshape
 * our public API, and we can guarantee that internal identifiers never leak.
 */

export interface ProjectRepository {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly description: string | null;
  readonly url: string;
  readonly homepage: string | null;
  readonly visibility: "public" | "private";
  readonly defaultBranch: string;
  readonly archived: boolean;
  readonly stars: number;
  readonly forks: number;
  readonly createdAt: string | null;
  readonly pushedAt: string | null;
}

export interface ProjectRelease {
  readonly tag: string;
  readonly name: string | null;
  readonly url: string;
  readonly prerelease: boolean;
  readonly publishedAt: string | null;
}

export interface ProjectCommit {
  readonly sha: string;
  readonly message: string;
  readonly url: string;
  readonly authorLogin: string | null;
  readonly committedAt: string | null;
}

export interface ProjectStatus {
  readonly repository: ProjectRepository;
  readonly issues: { readonly open: number };
  readonly pullRequests: { readonly open: number };
  readonly latestRelease: ProjectRelease | null;
  readonly latestCommit: ProjectCommit | null;
  /** ISO-8601 timestamp of when this snapshot was assembled. */
  readonly fetchedAt: string;
}
