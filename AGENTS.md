<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Color palette

Use the global palette tokens defined in `app/globals.css` for all UI color choices:

- `primary`: `#162042` — main actions, active states, and key emphasis
- `secondary`: `#2C385A` — supporting actions, secondary emphasis, and accents
- `neutral`: `#171717` — neutral text, icons, and dark UI surfaces

Use the corresponding Tailwind utilities (`bg-primary`, `text-secondary`, `border-neutral`, etc.) instead of adding raw hex values in components. Keep the palette centralized in `app/globals.css`; do not introduce or use a tertiary color.
