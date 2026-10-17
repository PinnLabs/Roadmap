import type { RepositorySlug } from "@/lib/repository-slug";

export interface GitHubClientOptions {
  readonly token?: string | null;
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
}

export interface GitHubRepository {
  readonly id: number;
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly description: string | null;
  readonly url: string;
  readonly homepage: string | null;
  readonly defaultBranch: string;
  readonly visibility: "public" | "private";
  readonly archived: boolean;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly pushedAt: string | null;
  readonly createdAt: string | null;
}

export interface GitHubRelease {
  readonly tag: string;
  readonly name: string | null;
  readonly url: string;
  readonly prerelease: boolean;
  readonly publishedAt: string | null;
}

export interface GitHubCommit {
  readonly sha: string;
  readonly message: string;
  readonly url: string;
  readonly authorLogin: string | null;
  readonly committedAt: string | null;
}

export interface GitHubOrganization {
  readonly login: string;
  readonly name: string | null;
  readonly url: string;
  readonly avatarUrl: string | null;
  readonly followers: number;
}

export interface GitHubMilestone {
  readonly title: string;
  readonly dueOn: string | null;
  readonly openIssues: number;
  readonly closedIssues: number;
}

export interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: "open" | "closed";
  /** `true` when the item is a pull request rather than an issue. */
  readonly isPullRequest: boolean;
  /** Only set for merged pull requests. */
  readonly mergedAt: string | null;
  readonly labels: readonly string[];
  readonly assignees: readonly { readonly login: string; readonly avatarUrl: string | null }[];
  readonly milestone: GitHubMilestone | null;
  readonly comments: number;
  readonly updatedAt: string | null;
  readonly closedAt: string | null;
}

export interface GitHubClient {
  /** Most recently updated issues and pull requests, open and closed. */
  listIssues(slug: RepositorySlug, limit?: number): Promise<GitHubIssue[]>;
  getOrganization(login: string): Promise<GitHubOrganization>;
  getRepository(slug: RepositorySlug): Promise<GitHubRepository>;
  countOpenIssues(slug: RepositorySlug): Promise<number>;
  countOpenPullRequests(slug: RepositorySlug): Promise<number>;
  getLatestRelease(slug: RepositorySlug): Promise<GitHubRelease | null>;
  getLatestCommit(slug: RepositorySlug): Promise<GitHubCommit | null>;
}
