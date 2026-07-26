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
  test: {
    include: ["lib/__tests__/**/*.test.{ts,tsx}"],
  },
});
