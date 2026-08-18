import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  // Component tests (.test.tsx) use React 19's automatic JSX runtime (handled by
  // vitest's oxc transform, no React import needed). The default per-test
  // environment stays node; a component test opts into jsdom with a
  // `// @vitest-environment jsdom` file comment.
  // The date tests below assert that a calendar day survives a server and a
  // reader in different zones, so they only mean anything in a zone that isn't
  // UTC. `npm test` pins TZ=America/Los_Angeles for that reason — run vitest
  // bare and a contributor in UTC would see them pass for the wrong reason.
  test: {
    include: ["lib/__tests__/**/*.test.{ts,tsx}"],
  },
});
