# CLAUDE.md

This file provides guidance to a coding agent when working with code in this repository.

## Central Configuration

This template carries only the project-scoped scaffold: this CLAUDE.md skeleton, `docs/PLANS.md` (ExecPlan methodology), and `docs/adr/README.md` (ADR convention). Cross-project rules and the generic workflow skills (`grill-me`, `close-out`, `codebase-design`, `adopt-from-sibling`, `harvest-session`, `backlog`) live in the central `Taka499/claude` repository, deployed user-level at `~/.claude` — do not copy them into projects.

`docs/PLANS.md` is the one document that exists in both places. The canonical copy is `docs/PLANS.md` in `Taka499/claude`; the copy here is downstream and is checked in so a plan stays followable from a fresh clone with no `~/.claude`. Change the canonical one and propagate; see the note at the top of the file.

## Documentation

Project documentation lives in `docs/`. When creating or updating plans, ExecPlans, or design docs, save them there. Reference existing docs in `docs/` for context on project phases and milestones.

Every document should be self-sufficient: the reader should never need to hunt for context. Explain concepts inline. When a concept is already defined in another checked-in document, you may reference it by file path and section rather than repeating it — but the reference must be precise enough that the reader can find it immediately (e.g., "see `docs/PLANS.md` § Milestones"), not vague ("see the architecture doc").

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan (as described in `docs/PLANS.md`) from design to implementation. ExecPlans are the persistence layer for cross-session development — they carry forward all context, decisions, and progress so that a fresh session can continue the work without loss. Completed plans are immutable history; when one finishes, run the close-out ritual (`close-out` skill) to extract its durable decisions before moving on.

## Durable Decisions (ADRs)

Cross-plan decisions live in `docs/adr/` (convention: `docs/adr/README.md`). This list is an index, not a home — one line per active decision with a pointer to its ADR; full context, provenance, and lifecycle live in the ADR file. Every non-obvious claim elsewhere in this file must cite its source (`per docs/adr/NNNN` or `per docs/plans/<plan>.md`) so this snapshot stays auditable and rebuildable. When an ADR corrects something an old plan asserted, the ADR wins.

- `docs/adr/0001-score-is-max-performance-parameter-gain-under-all-sp-route.md` — **accepted** (addendum 2026-09-21): a card's 点数 is its expected Vo+Da+Vi gain over one run under a route profile where every lesson is an SP lesson; conditional triggers count as satisfied by default, and that default can be lowered by the player in the panel or by a route profile; SP発生率+ scores 0.
- `docs/adr/0002-game-skill-filter-table-is-the-canonical-effect-taxonomy.md` — **superseded by 0004** (2026-09-21), but still what the code does until `docs/plans/EXECPLAN_COUNTING_MODEL.md` migrates it: effect categories come from the game's `SupportCardProduceSkillFilter.yaml` plus an audited extension list; conditional trigger ids match by longest prefix; an unclassifiable effect fails the data build.
- `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md` — **accepted**: thumbnails are extracted by us, named `img_general_{assetId}_full.webp`, stored in Cloudflare R2 and served by this app's Worker under `/img/*`.
- `docs/adr/0004-route-profiles-count-occasions-filters-and-conditions.md` — **accepted**, not yet implemented: route profiles count occasions (the game's phase types), filters (bounded counts in families with a family default) and conditions (bounded counts defaulting to the maximum); the filter table only supplies display names; a never-seen trigger piece is classified by shape or else hides its card and asks a person.
- `docs/adr/0005-the-site-never-publishes-a-number-it-cannot-stand-behind.md` — **accepted**: an effect the pipeline cannot count is never published as any number, flagged zero included; its card is hidden while the rest of the update publishes, and the question reaches the user as a conditional pull-request approval (Discord button planned, separate service).

## Project Overview

A static web page for 学園アイドルマスター players showing the サポカ凸別点数一覧: every support card as a row, its 点数 at 凸0 through 凸4 as columns, with a thumbnail that reveals the card name on hover, filterable by card type, plan and rarity. Points measure expected parameter gain over one run of a scenario (per `docs/adr/0001`), and the default scenario is H.I.F. (『Hatsuboshi IDOL FESTIVAL』) with 初LEGEND as the second shipped scenario. Scenarios are data files, not code, so a new game scenario is a new file (per `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`). Card data is generated weekly from the `vertesan/gakumasu-diff` YAML dump; the app is deployed as a Cloudflare Worker under the tia-tools organisation at its own tia.run subdomain, with an in-app feedback form posting to the private `tia-tools/feedback` repository (same plan, decisions D7–D8).

## Architecture

- `scripts/` — Bun generators (`generate-taxonomy.ts`, `generate-cards.ts`) over `scripts/lib/` (tables loader, classifier, trigger parser, card builder, emitters); they write the committed `data/*.generated.ts` (per `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md` Milestone 1). `scripts/lib/parse-trigger.ts` reads a trigger id as occasion, filters and conditions, and every generated effect carries the result as `trigger` beside its `categoryId` (per `docs/adr/0004` and `docs/plans/EXECPLAN_COUNTING_MODEL.md` Milestone 1); the scoring engine still reads `categoryId` until that plan's Milestone 2.
- `data/` — generated taxonomy, cards, level limits and `held.generated.ts` (cards the table must not show because an effect cannot be counted, per `docs/adr/0005`; the page does not read it until Milestone 4 of `docs/plans/EXECPLAN_COUNTING_MODEL.md`); `taxonomy.extensions.ts` (hand-written rows, per `docs/adr/0002`); `data/scenarios/` (one file per scenario with its route profiles, plus golden and real-data tests; same plan, Milestone 2).
- `src/engine/` — pure scoring engine (`score.ts`, `count.ts`, `types.ts`), no DOM, dependencies passed in. Two counting models live side by side until the page has moved (per `docs/plans/EXECPLAN_COUNTING_MODEL.md` decisions C8 and C16): `score()` without `scenarioId` counts taxonomy categories from `RouteProfile.counts`, which is what the page uses; with `scenarioId` it counts occasions, filters and conditions through `count.ts` from `RouteProfile.occasions`, `filters` and `conditions` (per `docs/adr/0004`). Every route profile states both, and `data/scenarios/equivalence.test.ts` requires them to publish identical scores.
- `scripts/images/` — Python (uv) image pipeline: `extract.py` downloads card art through a pinned, gitignored GkmasObjectManager checkout and writes 192 × 108 webp thumbnails, `upload.py` sends the ones the deployed site lacks to R2; rules live in pure tested modules (`thumbnail.py`, `decode.py`, `uploads.py`). Setup, commands and the reasons are in `scripts/images/README.md` (per `docs/adr/0003` and plan decisions D30–D32).
- `infra/worker/` — the Cloudflare Worker for `gakumas-supportcards.tia.run`: static assets from `dist/` plus `/img/*` from the R2 bucket `tia-assets` (`img.ts`, `worker.ts`, `wrangler.toml`); deploy and verify steps in `infra/worker/README.md`.
- `src/app/` — the Preact page, entered from `index.html` → `src/main.tsx`: pure `url-state.ts` (view state ⇄ query string) and `rows.ts` (score, filter, sort) with tests, and the components that render them (same plan, Milestone 3). The generated card data ships inline in the bundle (58 KB gzipped, per plan decision D28).

## Setup and Development

- Runtime and package manager: Bun. `bun install` installs the dev dependencies (`js-yaml`, `typescript`, type packages). Inside a sandbox that blocks `~/.bun`, run it as `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache" bun install`.
- Upstream game data is the `vertesan/gakumasu-diff` YAML dump. Scripts read each table from `.cache/gakumasu-diff/<Table>.yaml` when present and otherwise fetch `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` and cache it there; `.cache/` is gitignored, delete it to force a refresh.

## Build and Test

- `bun run dev` — Vite dev server at `http://localhost:5173`; `bun run build` writes `dist/`; `bun run preview` serves it. Thumbnails resolve to `/img/*`: in production the Worker serves them from R2 (per `docs/adr/0003`); the dev server serves them from `scripts/images/out/webp` when the images have been extracted locally, and otherwise the cells fall back to the card name.
- `bun run generate` — runs `scripts/generate-taxonomy.ts` then `scripts/generate-cards.ts`, rewriting `data/taxonomy.generated.ts`, `data/cards.generated.ts`, `data/held.generated.ts` and `data/levelLimits.generated.ts` from the cached tables. Output is deterministic (no timestamps), so a second run yields no diff. An effect that cannot be counted does not stop the run: its card is listed in `data/held.generated.ts` with the reason and the effect is left out of the card — a trigger piece of unknown kind (including an unknown `for_` scenario token), an effect type that is neither a stat nor an audited non-parameter type, or, until categories are removed, an (effect type, trigger) pair no taxonomy row covers. A hand-written row in `data/taxonomy.extensions.ts` that the game table has caught up with is left out with a warning. Exits 1 without writing when the dump itself looks broken: a schema error, an unknown enum value, item effect type or event reward resource, a dangling id, a skill that grants a P-item, or a card count that would drop (`--allow-fewer` overrides the last). `GAKUMASU_DIFF_CACHE=<dir>` points the generators at another table directory.
- `bun run type-check` — `tsc --noEmit` over `src/`, `scripts/`, `data/`, `infra/` and `vite.config.ts`.
- `uv run pytest` in `scripts/images/` — hermetic tests of the image pipeline rules (naming, thumbnail format, Unity-version fallback, upload planning, released-cards-only); needs `uv sync` first, no network and no vendored checkout.
- `bun test` — unit tests, co-located as `*.test.ts`: the Worker's image handler against a fake bucket (`infra/worker/img.test.ts`), generator rules against small fixtures (`scripts/lib/`), the scoring engine against fixture cards (`src/engine/score.test.ts`, `src/engine/count.test.ts`), a real-data check that every shipped route profile names only existing categories, names every category, occasion and filter the generated cards use (an omitted one would silently score 0, so 0 must be written), keeps every filter and condition count within its occasion, and scores all cards finitely (`data/scenarios/scenarios.test.ts`), the old-versus-new counting equivalence over every card, profile and 凸 (`data/scenarios/equivalence.test.ts`), and golden scores over frozen copies of ten cards, so a game rebalance cannot fail them (`data/scenarios/golden.test.ts` with `golden.snapshot.ts`, per `docs/plans/EXECPLAN_COUNTING_MODEL.md` decision C8).

## Code Style

<!-- Language-specific conventions, naming patterns, import ordering, or formatting tools in use. -->

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

