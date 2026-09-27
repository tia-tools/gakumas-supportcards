# Lint the code with Oxlint: size, complexity and type escape hatches become errors a machine reports

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

## Purpose / Big Picture

Nothing checks this repository's code for the problems a human reviewer used to catch: over-long or over-complex functions, blocks nested too deeply, `any`, the non-null assertion `x!`, the cast `x as T`, promises handed to places that ignore them, and patterns an attacker can abuse (a regular expression that can take exponential time, a file path built from outside input). The user's cross-project rules require those to be lint errors that stop a change, not review comments. This repository has had no linter since 2026-09-20: the usual tool, ESLint with typescript-eslint, cannot load under TypeScript 7, which this repository uses (decision D29 in `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`). The user decided on 2026-09-28 to use Oxlint instead (decision D45 in the same plan).

After this plan, `bun run lint` checks every TypeScript file in the repository and exits 0 on the whole code base. It exits 1 when someone adds, for example, an `any` or a 70-line function. Both workflows that publish to the live site run it before anything is published: `.github/workflows/deploy.yml` before a deploy, and `.github/workflows/update-data.yml` before the weekly data merge. A failing lint therefore stops a deploy or a data update the same way a failing test does. To see it working: run `bun run lint` and read `Found 0 warnings and 0 errors`; add `const x: any = 1;` to any file under `src/`, run it again and see exit status 1 naming `typescript(no-explicit-any)`; remove the line.

No score, page or data file may change because of this plan. It is a refactor of how the code is written, guarded by the existing tests and by the rule that a published score may not move unless its card's data moved (`scripts/check-score-stability.ts`, per `docs/adr/0006`).

## Progress

- [x] (2026-09-27 20:45Z) Measured: Nudge's configuration run over this repository from a throwaway folder (nothing installed here) reports 60 findings in 18 files; the full list is in § Artifacts and Notes. Plan written.
- [ ] Milestone 1: Oxlint installed as dev dependencies, `oxlint.config.ts` and the `lint` script in place, the configuration proven to load, baseline count recorded. Not yet a gate.
- [ ] Milestone 2: mechanical findings drained — non-null assertions, type assertions, the misused promise, the file-path exceptions, the two regular expressions.
- [ ] Milestone 3: structural findings drained outside `parseTrigger` — long test functions, deep nesting, nested callbacks, `src/app/panel.ts` complexity.
- [ ] Milestone 4: `parseTrigger` in `scripts/lib/parse-trigger.ts` brought under the limits with no change in behaviour.
- [ ] Milestone 5: `bun run lint` is a gate in both publishing workflows and in the pull-request check `check.yml`, documentation updated, released and seen green on GitHub.

## Surprises & Discoveries

- Observation: The first throwaway install could not load `eslint-plugin-security`: `Failed to load JS plugin: eslint-plugin-security … Cannot find module 'safe-regex'`. Its dependency `safe-regex` was on disk without its `package.json` and `index.js`. A fresh package cache plus `bun install --linker hoisted` fixed it, so the cause was a damaged cache and not necessarily Bun's default (isolated) install layout. Which of the two mattered was not separated.
  Evidence: `ls node_modules/safe-regex` showed only `bin example lib test` before, and the full file set after the reinstall with `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache-ox"`. Milestone 1 must prove in this repository that the plugin loads (see its acceptance) and record which layout was needed.
- Observation: `.claude/worktrees/counting-model` is a second git checkout of this repository inside it. Oxlint would lint it and report every finding twice unless `.claude/**` is ignored.
  Evidence: `git worktree list` shows `/Users/ghensk/Developer/gakumas-supportcards/.claude/worktrees/counting-model` on branch `chore/ignore-claude-worktrees`. The measurement ignored `.claude/**`.

## Decision Log

- Decision (O1): Start from Nudge's `oxlint.config.ts`, the configuration the user-level TypeScript stack note (`~/.claude/docs/typescript.md` § Lint & static-analysis policy › Oxlint path) was measured on, and change only what this repository needs: more ignore patterns, the test-file size override widened to every `*.test.ts`, and the path-by-design file-reading exception described in O3. Its content at the time of writing is reproduced in § Interfaces and Dependencies, so this plan does not depend on a checkout of Nudge.
  Rationale: The policy is the user's and is the same for every project. Copying a configuration already proven to load and to fire each rule saves re-deriving it; only local facts differ.
  Date/Author: 2026-09-28 / agent, following the user's decision D45.
- Decision (O2): Every rule is at `error` from the first commit, and the lint does not become a workflow gate until the backlog is zero (Milestone 5). The user's rule "introduce a new strict rule as a warning, drain the backlog to zero, then ratchet it to error" is met by this ordering: until Milestone 5 nothing blocks on the findings, which is the purpose of the warning phase. The findings are drained in this plan, on its branch, not left for later.
  Rationale: 60 findings in 18 files are small enough to drain in one plan. A warning level that nobody is forced to read is what the user's rules forbid; a known list drained milestone by milestone is not that.
  Date/Author: 2026-09-28 / agent.
- Decision (O3): `security/detect-non-literal-fs-filename` is switched off, in the configuration and with a written reason, only for build-time scripts that read and write repository files by path: `scripts/**/*.ts` and `vite.config.ts`. It stays on for `src/**` (the page) and `infra/**` (the Worker), which are the code that handles outside input. `vite.config.ts` is included because its only file access serves `/img/*` in the dev server, and it reaches the disk only after `imageKey` (`infra/worker/img.ts`) has matched the request path against a fixed pattern of image names, so no request path is used as a file path. Milestone 2 re-reads that code and must reverse this decision for `vite.config.ts` if it is no longer true.
  Rationale: Those 14 findings are the scripts doing their job: reading the cached game tables, writing generated data, reading the committed score snapshot. The rule exists to catch a request-controlled path, and none of these paths comes from a request. An exception in the configuration file carries its reason and can be re-judged later; inline suppressions are forbidden by the user's rules.
  Date/Author: 2026-09-28 / agent.

## Outcomes & Retrospective

Nothing yet.

## Context and Orientation

The repository is a static web page (Preact, built by Vite) that shows a score table for support cards of the game 学園アイドルマスター, served by a Cloudflare Worker. `CLAUDE.md` at the root describes the whole layout. The TypeScript lives in five places, all checked by one `tsconfig.json` whose `include` is `src/**/*`, `scripts/**/*`, `data/**/*`, `infra/**/*` and `vite.config.ts`:

- `src/engine/` is the scoring engine (pure functions).
- `src/app/` is the page's model and its Preact components (`*.tsx`).
- `scripts/` holds the Bun scripts that generate `data/*.generated.ts` from the game's tables, plus `scripts/lib/` with their rules and tests.
- `data/` holds the generated data and the scenario files with their tests.
- `infra/worker/` is the Worker.

`scripts/images/` is a Python project and is not linted by this plan.

The runtime and package manager is Bun. Tests are `bun test` (co-located `*.test.ts` files, `bun:test` API), and the type check is `bun run type-check` (`tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`). TypeScript is `typescript@^7.0.2`, the native compiler.

"Lint" means a program that reads source code without running it and reports patterns that are allowed by the compiler but break a rule. "Oxlint" is such a program, written in Rust and published on npm as `oxlint`. "Type-aware" rules need the program's types (for example, "this expression is a promise"); Oxlint gets them from `oxlint-tsgolint`, a companion npm package built on TypeScript 7's native compiler. `eslint-plugin-security` is a set of ESLint rules that Oxlint can load as a "JS plugin" (a plugin written in JavaScript, listed under `jsPlugins` in the configuration).

The policy comes from the user-level stack note `~/.claude/docs/typescript.md`, and this plan restates what it needs so that no other file is required. Size and complexity limits are errors:
- `max-lines-per-function` 60, not counting blank lines and comments, and 120 in test files;
- `complexity` 15, which is cyclomatic complexity (roughly one plus the number of branches: `if`, `&&`, `||`, `??`, `?:`, `case`, loops);
- `max-depth` 4 (nested blocks);
- `max-nested-callbacks` 4;
- `max-params` as a warning at 6.

The type escape hatches are errors: `typescript/no-explicit-any`, `typescript/no-non-null-assertion` (the `x!` operator) and `typescript/consistent-type-assertions` with `assertionStyle: "never"`. That last rule forbids every `x as T` and `<T>x` but allows `as const`: the repository uses `as const` in `src/app/Breakdown.tsx`, `src/app/panel.test.ts` and `src/app/rows.test.ts`, and the measurement flagged none of them.

Four type-aware rules are errors:
- `no-floating-promises`: a promise neither awaited nor handled;
- `no-misused-promises`: an async function passed where a plain callback is expected, such as a Preact `onClick`;
- `await-thenable`;
- `no-base-to-string`: an object turned into `"[object Object]"`.

`no-redundant-type-constituents` and `no-empty` (a swallowed `catch {}`) are errors, and so are the listed `security/*` rules.

The user's rules forbid silencing a finding inline (`// oxlint-disable`, `// eslint-disable`, `@ts-ignore`, `@ts-expect-error`). A finding is fixed at its root. A justified exception goes into `oxlint.config.ts` as an entry with its reason and the condition for removing it.

Where the lint must run once it is a gate:
- `.github/workflows/deploy.yml` runs `bun test`, `bun run type-check`, `bun scripts/check-score-stability.ts` and `bun run build`, then deploys. It runs on every push to `main` that touches the page, data or Worker, and whenever `update-data.yml` calls it.
- `.github/workflows/update-data.yml` regenerates the data weekly (a daily schedule is decided, decision D46 in `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`). When the data changed, it runs the gates "Gate: unit tests", "Gate: type check" and "Gate: no score moved without its card's data moving" before it opens and merges a pull request into `main`.
- `scripts/lib/workflows.test.ts` parses both workflows and pins their properties. One test lists the gates that must come before `gh pr merge`, and the lint gate must be added there.

`.github/workflows/check.yml` (decision D47 in the same plan, added 2026-09-28) runs `bun test`, `bun run type-check`, `bun scripts/check-score-stability.ts` and `bun run build` on every pull request into `develop`, read-only; the lint runs there too, and `scripts/lib/workflows.test.ts`'s test "runs every check deploy.yml runs before production" lists its steps. Every action in the workflows is pinned to a full commit hash, which the same test file enforces.

Branching follows `CLAUDE.md` § Commit Discipline:
- `develop` is development and `main` is production; merging into `main` deploys.
- Work happens on a feature branch from an up-to-date `develop`, here `feature/oxlint`, and is merged back into `develop` with a merge commit.
- Commits are small, one per meaningful step, and each needs the user's approval. The agent proposes and does not commit on its own.
- Releasing into `main` is also the user's decision.

## Plan of Work

Milestone 1 installs the tools and the configuration without changing any code. Add `oxlint`, `oxlint-tsgolint` and `eslint-plugin-security` as dev dependencies with `bun add -d`. Create `oxlint.config.ts` at the root from the content in § Interfaces and Dependencies. Add `"lint": "oxlint --deny-warnings"` to `package.json` `scripts`; the flag makes the warning-level `max-params` fail too. Run it and compare with the baseline in § Artifacts and Notes: the counts per rule should match, except `max-lines-per-function` in test files, which the widened override lowers (see Artifacts). Then prove the configuration is really loaded: add `const probe: any = 1;` to `src/engine/score.ts`, run `bun run lint`, see exit status 1 with `typescript(no-explicit-any)`, and remove it. This matters because a configuration that fails to load and a clean run can both print nothing. If `eslint-plugin-security` fails to load (see Surprises), try `bun install --linker hoisted` and record which layout this repository needs. Acceptance: the lint runs, the probe fails it, and the counts are recorded in Progress. Commit proposal: `chore: Oxlint with tsgolint and eslint-plugin-security — config and lint script, not yet a gate (D45)`.

Milestone 2 removes the findings that need no redesign.

- **Non-null assertions** (`src/app/rows.test.ts` lines 32–43, `scripts/lib/build-cards.test.ts` lines 170–204): replace each `x!` with a small typed helper that throws when the value is missing. The tests already use this idiom elsewhere, as in `data/scenarios/golden.test.ts`'s `card(id)`, which throws `… is not in golden.snapshot.ts`. Keep one such helper per test file, or share one in a test-only module if three or more files need it.
- **Type assertions**: replace each `x as T` with a type guard (`const isT = (x: unknown): x is T => …`) or with a value whose type is correct from the start. The sites are `infra/worker/feedback.test.ts` (5), `infra/worker/feedback.ts` line 82, `scripts/lib/build-cards.ts` line 299, `scripts/lib/workflows.test.ts` lines 33 and 77 (the parsed YAML; a guard for the `Workflow` shape is the honest fix there), `src/app/FeedbackForm.tsx` line 15 and `src/app/url-state.ts` line 72.
- **The misused promise** in `src/app/FeedbackForm.tsx` line 67: an async function passed to a JSX event attribute. Wrap it as `() => void send()`, or handle the promise inside a synchronous handler, so a rejection is not silently dropped. Check the existing error handling of the form still reports a failure to the user.
- **The file-path exceptions**: add the O3 override to `oxlint.config.ts`, after re-reading `vite.config.ts`'s `localImageLibrary` to confirm the path still passes through `imageKey`.
- **The two unsafe regular expressions.** `FEEDBACK_VIEW_PATTERN` in `infra/worker/feedback-contract.ts` line 20 is `^(\?[A-Za-z0-9._~%&=+*-]{1,2000})?$`. It has one character class under one bounded repetition, so it cannot backtrack exponentially; the finding comes from `safe-regex` treating any repetition bound above 25 as unsafe. `LESSON` in `scripts/lib/parse-trigger.ts` line 41 is `^lesson_(?:(vocal|dance|visual)(?:_([a-z]+))?|([a-z]+))$`. It has nested optional groups but distinct separators, so it also cannot backtrack badly. Rewriting is preferred when it is simple and keeps meaning:
  - For the first, match `^(\?[A-Za-z0-9._~%&=+*-]+)?$` and check the length (at most 2001 characters including the `?`) in code next to it. Its tests in `infra/worker/` must still accept and reject the same inputs; add a test at 2001 and 2002 characters if none exists, and watch it fail before the length check is added.
  - For the second, `parse-trigger` is rewritten in Milestone 4 anyway, where splitting on `_` may remove the need for the pattern. Leave this finding to Milestone 4.

  If a rewrite would be less clear than the pattern, an exception in the configuration with the reasoning above is acceptable instead.

Acceptance: `bun run lint` reports only the Milestone 3 and 4 findings, and `bun test`, `bun run type-check` and `bun scripts/check-score-stability.ts` pass. Commit one proposal per kind of finding.

Milestone 3 removes the structural findings outside `parseTrigger`.

- **Long test functions** (`src/engine/score.test.ts` line 53, 139 lines; `scripts/lib/build-cards.test.ts` line 82, 122 lines): each is one `describe` callback holding many tests. Split them into several `describe` blocks by topic, which also makes the test report easier to read. No assertion may be dropped, and the count of tests reported by `bun test` must stay the same.
- **Nested callbacks** (`data/scenarios/scenarios.test.ts` lines 42 and 55, five levels): lift the inner loops into named helper functions.
- **Deep nesting** (`scripts/lib/build-cards.ts` lines 252–255 and `scripts/lib/profile-gate.ts` lines 24–25, depth 5–6): extract the inner block into a function with an early `continue` or `return`.
- **`src/app/panel.ts`**: `applyOverrides` (complexity 21), `buildPanel` (16) and an anonymous callback at line 169 (16) are brought to 15 or below by extracting named helpers. Each helper is a pure function, so `src/app/panel.test.ts` covers it through its caller. Add a direct test only when a helper gains a branch no existing test reaches.

Acceptance: as in Milestone 2, and the list of test names from `bun test` is unchanged apart from any added tests. Commit per file or per pair of related files.

Milestone 4 rewrites `parseTrigger` in `scripts/lib/parse-trigger.ts` (complexity 46, 75 lines) to satisfy the limits without changing what it returns for any input. It reads a trigger id such as `p_trigger-lesson_end-lesson_vocal_sp` token by token after the head that the phase type fixes. It returns `{ kind: "parsed", trigger }`, where the trigger has an occasion, filters, conditions and an optional scenario, or `{ kind: "unknown-piece", piece }`.

Use one small function per token kind: a range, noise, a `p_card_search` section, `effect_group`, `produce_card_search_count`, a named condition followed by a range, a lesson token, and `for_<scenario>`. Each takes the shared parsing state and the token index, and returns either how many tokens it consumed or an `unknown-piece` result. The loop in `parseTrigger` then tries them in the current order. Keep that order exactly: it is part of the behaviour, because `effect_group` consumes three following tokens and a named condition consumes one.

The behaviour is proven unchanged in three ways:
- `scripts/lib/parse-trigger.test.ts` passes unchanged;
- `bun run generate` over the current cached tables leaves `git diff --exit-code -- data/` clean, since every card's parsed triggers are in `data/cards.generated.ts`;
- `bun scripts/check-score-stability.ts` passes.

Before relying on the second, confirm it can catch a change: temporarily make the lesson parser drop the `lessonKind` filter, run `bun run generate`, see `data/` change, then restore. If `.cache/gakumasu-diff/` is absent, `bun run generate` fetches the tables from GitHub first. Either way, run it once on `develop` before the change to be sure the output matches the committed data, because a newer upstream table would show up as a diff that has nothing to do with this rewrite.

Acceptance: `bun run lint` reports `Found 0 warnings and 0 errors`, together with the three proofs above. Commit proposal: `refactor: parseTrigger one function per token kind — under the lint limits, output unchanged`.

Milestone 5 makes the lint a gate and ships it.

- **`.github/workflows/deploy.yml`**: add `- run: bun run lint` after `bun run type-check`.
- **`.github/workflows/update-data.yml`**: add a step named `"Gate: lint"` with `if: steps.detect.outputs.changed == 'true'` and `run: bun run lint`, after "Gate: type check" and before the score-stability gate.
- **`scripts/lib/workflows.test.ts`**:
  - add `"bun run lint"` to the list in the test "every gate comes before the merge, and none of them may be skipped on failure", and watch that test fail when the new step is moved after the merge step, then restore;
  - in the `deploy.yml` test that checks gates run before `wrangler@4 deploy`, add `"bun run lint"` in the same way.
- **`.github/workflows/check.yml`**: add `- run: bun run lint` after `bun run type-check`, and add `"bun run lint"` to the list in its test "runs every check deploy.yml runs before production".
- **Docs**:
  - `CLAUDE.md`: in § Build and Test add a line for `bun run lint` (what it checks, and that exceptions live in `oxlint.config.ts` with reasons). In § Code Style state the limits in one sentence, citing `docs/plans/EXECPLAN_OXLINT.md` and D45. Update the `.github/workflows/update-data.yml` line to name the lint gate.
  - `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`: add a revision note that D45 is implemented.

Then merge `feature/oxlint` into `develop`; the release into `main` happens when the user approves it. Acceptance on GitHub: the Deploy run of that release shows the `bun run lint` step green. The type-aware part needs `oxlint-tsgolint`'s Linux binary, which `bun install --frozen-lockfile` must install from the lockfile on the runner, and this run is where that is first proven. A later `update-data.yml` run with changed data shows "Gate: lint" green.

## Concrete Steps

All commands run in the repository root, `/Users/ghensk/Developer/gakumas-supportcards` on the user's machine. Inside a sandbox that blocks `~/.bun`, prefix installs with `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache"`, and use a fresh directory there if a package arrives incomplete (see Surprises).

Branch:

    git fetch
    git switch develop && git merge --ff-only origin/develop
    git switch -c feature/oxlint

Milestone 1:

    bun add -d oxlint oxlint-tsgolint eslint-plugin-security
    # write oxlint.config.ts, add "lint": "oxlint --deny-warnings" to package.json scripts
    bun run lint > "$TMPDIR/lint.txt" 2>&1; echo "exit $?"; tail -3 "$TMPDIR/lint.txt"
    # expect exit 1 and a "Found … errors" line comparable with § Artifacts and Notes

Keep the command's own exit status visible: redirect to a file and read the file, rather than piping into `grep` or `tail`, which would report the filter's status.

Each later milestone ends with:

    bun run lint > "$TMPDIR/lint.txt" 2>&1; echo "lint exit $?"
    bun test > "$TMPDIR/test.txt" 2>&1; echo "test exit $?"; tail -3 "$TMPDIR/test.txt"
    bun run type-check > "$TMPDIR/tc.txt" 2>&1; echo "type-check exit $?"
    bun scripts/check-score-stability.ts > "$TMPDIR/stab.txt" 2>&1; echo "stability exit $?"

Milestone 4 adds:

    bun run generate > "$TMPDIR/gen.txt" 2>&1; echo "generate exit $?"
    git diff --exit-code --stat -- data/; echo "data diff exit $?"   # 0 means no change

## Validation and Acceptance

The plan is accepted when all of the following hold.

- On `develop` after the merge, `bun run lint` exits 0 and prints `Found 0 warnings and 0 errors`.
- Adding `const probe: any = 1;` to `src/engine/score.ts` makes it exit 1 naming `typescript(no-explicit-any)`.
- `bun test` passes with at least the 191 tests of 2026-09-24 plus any added. `bun run type-check` exits 0, and `bun scripts/check-score-stability.ts` exits 0.
- `bun run generate` leaves `data/` unchanged.
- `scripts/lib/workflows.test.ts` fails when the lint gate is removed from, or moved after the merge in, either workflow.
- On GitHub, the Deploy run of the release shows the lint step green.

The published page must look and score exactly as before; the stability check is the proof of that.

## Idempotence and Recovery

Every step can be repeated. `bun add -d` of an installed package is a no-op, and `bun run lint`, the tests and `bun run generate` write nothing outside `data/` (generate is deterministic and rewrites the same files). A refactor that goes wrong is undone with `git restore <file>` before committing, or by reverting the one small commit afterwards. The gate is added last, so until Milestone 5 nothing that publishes depends on this work. If the lint step fails on GitHub after the release, for example because the Linux binary did not install, revert the gate commit on a branch from `develop` and release that. Removing the gate does not touch the site.

## Artifacts and Notes

The baseline, measured 2026-09-27 20:40Z with Oxlint 1.85, oxlint-tsgolint 7.0.2003 and eslint-plugin-security 4, using Nudge's configuration with `dist/**`, `scripts/images/**`, `.claude/**` and `.cache/**` added to its ignore list. Nudge's test override covers only `src/**/*.test.ts`, so test files elsewhere were held to 60 lines:

    17 typescript(no-non-null-assertion)   src/app/rows.test.ts 10, scripts/lib/build-cards.test.ts 7
    14 security(detect-non-literal-fs-filename)
                                           scripts/lib/tables.ts 4, scripts/update-report.ts 4,
                                           scripts/check-score-stability.ts 3, vite.config.ts 2,
                                           scripts/lib/workflows.test.ts 1
    11 typescript(consistent-type-assertions)
                                           infra/worker/feedback.test.ts 5, scripts/lib/workflows.test.ts 2,
                                           infra/worker/feedback.ts 1, scripts/lib/build-cards.ts 1,
                                           src/app/FeedbackForm.tsx 1, src/app/url-state.ts 1
     5 eslint(max-lines-per-function)      src/engine/score.test.ts:53 (139), scripts/lib/build-cards.test.ts:82 (122),
                                           data/scenarios/scenarios.test.ts:20 (81), infra/worker/feedback.test.ts:100 (75),
                                           scripts/lib/parse-trigger.ts:65 parseTrigger (75)
     4 eslint(max-depth)                   scripts/lib/build-cards.ts:252,255; scripts/lib/profile-gate.ts:24,25
     4 eslint(complexity)                  parseTrigger 46; src/app/panel.ts applyOverrides 21, buildPanel 16, line 169 16
     2 eslint(max-nested-callbacks)        data/scenarios/scenarios.test.ts:42,55
     2 security(detect-unsafe-regex)       infra/worker/feedback-contract.ts:20, scripts/lib/parse-trigger.ts:41
     1 typescript(no-misused-promises)     src/app/FeedbackForm.tsx:67
    60 problems

With this plan's configuration two things change from the baseline:
- The test override covers every `*.test.ts`, so `scenarios.test.ts` (81) and `feedback.test.ts` (75) fall under its 120-line limit and drop out, while `score.test.ts` and `build-cards.test.ts` remain.
- O3 removes all 14 file-path findings: the 12 in `scripts/`, including the one in `scripts/lib/workflows.test.ts`, and the 2 in `vite.config.ts`.

Milestone 1 should therefore report 60 − 2 − 14 = 44 errors, or explain the difference.

## Interfaces and Dependencies

Dev dependencies: `oxlint` (^1.85), `oxlint-tsgolint` (^7.0.2002, the TypeScript 7 type-aware backend) and `eslint-plugin-security` (^4.0.1). No runtime dependency changes. `package.json` gains `"lint": "oxlint --deny-warnings"`.

`oxlint.config.ts` at the repository root, to be written as follows. The header comment must say what it guards and where exceptions go.

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
      ignorePatterns: ["node_modules/**", "dist/**", ".cache/**", ".claude/**", ".wrangler/**", "scripts/images/**"],
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
          // No path comes from outside input (decision O3). Remove an entry if its file starts taking a
          // path from a request.
          files: ["scripts/**/*.ts", "vite.config.ts"],
          rules: { "security/detect-non-literal-fs-filename": "off" },
        },
      ],
    });

Nudge's own file uses quoted keys throughout. The unquoted form above is equivalent and matches this repository's TypeScript style. `security/detect-child-process` stays on: `vite.config.ts` reads the commit with `execFileSync("git", ["rev-parse", "--short=12", "HEAD"])`, and the measurement, which ran that rule, did not flag it, because the command is a fixed string.

The functions whose shape changes, with signatures that must stay as they are: `parseTrigger(triggerId: string, phaseType: string, scenarioTokens?: Readonly<Record<string, string>>): ParseResult` in `scripts/lib/parse-trigger.ts`; `applyOverrides` and `buildPanel` in `src/app/panel.ts`; `FEEDBACK_VIEW_PATTERN` in `infra/worker/feedback-contract.ts` (if it is replaced by a function, every importer must be updated in the same commit, and the page and the Worker must still agree).

## Revision notes

- 2026-09-28: `.github/workflows/check.yml` now exists (D47), so Context and Milestone 5 name it instead of treating it as optional. Reason: D46 and D47 were implemented the same day, before this plan started.
