export interface RepositorySlug {
  readonly owner: string;
  readonly name: string;
}

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

const MAX_OWNER_LENGTH = 39;
const MAX_NAME_LENGTH = 100;

function isValidOwner(owner: string): boolean {
  return (
    owner.length > 0 &&
    owner.length <= MAX_OWNER_LENGTH &&
    SEGMENT_PATTERN.test(owner) &&
    !owner.includes(".") &&
    !owner.includes("_") &&
    !owner.startsWith("-") &&
    !owner.endsWith("-")
  );
}

function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_NAME_LENGTH &&
    SEGMENT_PATTERN.test(name) &&
    name !== "." &&
    name !== ".."
  );
}

export function parseRepositorySlug(input: string): RepositorySlug | null {
  if (typeof input !== "string") {
    return null;
  }

  const segments = input.split("/");

  if (segments.length !== 2) {
    return null;
  }

  const [owner, name] = segments;

  if (!isValidOwner(owner) || !isValidName(name)) {
    return null;
  }

  return { owner, name };
}

export function formatRepositorySlug(slug: RepositorySlug): string {
  return `${slug.owner}/${slug.name}`;
}

export function sameRepository(a: RepositorySlug, b: RepositorySlug): boolean {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

export function isTrackedRepository(
  slug: RepositorySlug,
  tracked: readonly RepositorySlug[],
): boolean {
  return tracked.some((candidate) => sameRepository(candidate, slug));
}
