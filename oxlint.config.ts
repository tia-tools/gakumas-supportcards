// Lint policy per the user-level TypeScript stack note (~/.claude/docs/typescript.md § Lint &
// static-analysis policy): size, complexity and type escape hatches are errors, not review comments.
// Oxlint with tsgolint because this repository is on TypeScript 7, whose npm package has no
// JavaScript API for typescript-eslint or eslint-plugin-sonarjs (docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md
// D29, D45; docs/plans/EXECPLAN_OXLINT.md). sonarjs's cognitive-complexity and assertions-in-tests have
// no Oxlint equivalent: `complexity` is 15 rather than 20 for the first, and the rule that every new
// test is first seen to fail covers the second. Exceptions go here with a reason and a removal
// condition, never inline.
import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "eslint", "oxc"],
  jsPlugins: ["eslint-plugin-security"],
  categories: { correctness: "error" },
  options: { typeAware: true },
  // .claude/worktrees holds other checkouts of this repository (gitignored); the rest of .claude stays lintable.
  ignorePatterns: ["node_modules/**", "dist/**", ".cache/**", ".claude/worktrees/**", ".wrangler/**", "scripts/images/**"],
  rules: {
    "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    complexity: ["error", 15],
    "max-depth": ["error", 4],
    "max-nested-callbacks": ["error", 4],
    "max-params": ["warn", 6],
    "no-empty": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-base-to-string": "error",
    "typescript/no-redundant-type-constituents": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-new-buffer": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-child-process": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-non-literal-require": "error",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-bidi-characters": "error",
  },
  overrides: [
    {
      // Tests group many cases under one describe; 120 lines, as in Nudge. Remove when no test
      // function needs more than 60.
      files: ["**/*.test.ts"],
      rules: { "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }] },
    },
    {
      // Build-time scripts read and write repository files by path: cached game tables, generated
      // data, the committed score snapshot, workflow files; vite.config.ts serves /img/* in the dev
      // server only after infra/worker/img.ts imageKey has matched the path against fixed image names.
      // No path comes from outside input (docs/plans/EXECPLAN_OXLINT.md decision O3). Remove an entry
      // if its file starts taking a path from a request.
      files: ["scripts/**/*.ts", "vite.config.ts"],
      rules: { "security/detect-non-literal-fs-filename": "off" },
    },
  ],
});
