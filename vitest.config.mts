import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests run in a plain Node environment: the API layer is pure TypeScript
 * with `fetch` injected, so there is no Next.js runtime involved.
 *
 * `server-only` ships a module that throws unless it is resolved under the
 * `react-server` condition. Tests import the data-access layer directly, so we
 * alias it to an inert stub. Next.js itself resolves the real package at build
 * time and still fails the build if server-only code reaches the client.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
