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

export interface GitHubClient {
  getRepository(slug: RepositorySlug): Promise<GitHubRepository>;
  countOpenIssues(slug: RepositorySlug): Promise<number>;
  countOpenPullRequests(slug: RepositorySlug): Promise<number>;
  getLatestRelease(slug: RepositorySlug): Promise<GitHubRelease | null>;
  getLatestCommit(slug: RepositorySlug): Promise<GitHubCommit | null>;
}
