export interface NavLink {
  readonly href: string;
  readonly label: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Roadmap (Kanban)" },
  { href: "/releases", label: "Releases & Changelog" },
  { href: "/health", label: "Repository Health" },
];

export const RSS_HREF = "/feed.xml";
export const SUBSCRIBE_HREF = "/subscribe";
export const ACCOUNT_HREF = "/account";
