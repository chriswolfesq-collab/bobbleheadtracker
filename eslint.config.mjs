import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The second dev server's build output (NEXT_DIST_DIR / dev:alt) — same
    // generated code as .next, same reason to ignore it.
    ".next-alt/**",
    // Parallel-session worktrees under .claude are copies of this repo; linting
    // them double-reports every finding against paths nobody is editing here.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
