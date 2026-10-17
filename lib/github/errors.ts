export type GitHubErrorCode =
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network"
  | "upstream";

export interface GitHubErrorOptions {
  readonly code: GitHubErrorCode;
  readonly status?: number | null;
  readonly retryAfterSeconds?: number | null;
  readonly cause?: unknown;
}

export class GitHubError extends Error {
  readonly code: GitHubErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, options: GitHubErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "GitHubError";
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}
