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
- `docs/adr/0002-game-skill-filter-table-is-the-canonical-effect-taxonomy.md` — **superseded by 0004** (2026-09-21) and no longer in the code: the taxonomy, its extension list and the classifier were deleted by Milestone 3 of `docs/plans/EXECPLAN_COUNTING_MODEL.md`. Kept as history of why effects were once counted per row of the game's `SupportCardProduceSkillFilter.yaml`.
- `docs/adr/0003-owned-image-library-on-r2-served-through-the-app-worker.md` — **accepted**: thumbnails are extracted by us, named `img_general_{assetId}_full.webp`, stored in Cloudflare R2 and served by this app's Worker under `/img/*`.
- `docs/adr/0004-route-profiles-count-occasions-filters-and-conditions.md` — **accepted**, implemented (2026-09-21 addendum): route profiles count occasions (the game's phase types), filters (bounded counts in families; only the effect-group families state a default) and conditions (bounded counts defaulting to the maximum); the filter table is no longer read at all, names come from a small dictionary of ours; a never-seen trigger piece is classified by shape or else hides its card and asks a person.
- `docs/adr/0005-the-site-never-publishes-a-number-it-cannot-stand-behind.md` — **accepted** (addendum 2026-09-22, hiding implemented): an effect the pipeline cannot count — unreadable, or readable but without a number in some shipped route profile — is never published as any number, flagged zero included; its card is listed in `data/held.generated.ts` and hidden while the rest of the update publishes, and the question reaches the user as a conditional pull-request approval (Discord button planned, separate service).
- `docs/adr/0006-published-scores-are-committed-and-an-update-may-not-move-them.md` — **accepted**: `data/scores.generated.json` is a committed snapshot of every published score, and `scripts/check-score-stability.ts` fails when a card whose generated record did not change scores differently; a deliberate profile or engine change fails it by design and is resolved by committing the regenerated snapshot.

## Project Overview

A static web page for 学園アイドルマスター players showing the サポカ凸別点数一覧: every support card as a row, its 点数 at 凸0 through 凸4 as columns, with a thumbnail that reveals the card name on hover, filterable by card type, plan and rarity. Points measure expected parameter gain over one run of a scenario (per `docs/adr/0001`), and the default scenario is H.I.F. (『Hatsuboshi IDOL FESTIVAL』) with 初LEGEND as the second shipped scenario. Scenarios are data files, not code, so a new game scenario is a new file (per `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`). How often an effect fires is counted by occasion, filters and conditions (per `docs/adr/0004`; `docs/plans/EXECPLAN_COUNTING_MODEL.md`, complete 2026-09-22 — the migration moved no score across 204 cards × 4 route profiles × 凸0–4, and a replay of the 2026-09-20 data update passes the stability check). Card data is generated weekly from the `vertesan/gakumasu-diff` YAML dump; the app is deployed as a Cloudflare Worker under the tia-tools organisation at its own tia.run subdomain, with an in-app feedback form posting to the private `tia-tools/feedback` repository (same plan, decisions D7–D8).

## Architecture

- `scripts/` — the Bun generator `generate-cards.ts` over `scripts/lib/` (tables loader, trigger parser, effect-type audit, card builder, emitters); it writes the committed `data/*.generated.ts` (per `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md` Milestone 1). `scripts/lib/parse-trigger.ts` reads a trigger id as occasion, filters and conditions, and every generated effect carries the result as `trigger`; `scripts/lib/effect-types.ts` lists which effect types are parameter gains and which are audited as none (per `docs/adr/0004` and `docs/plans/EXECPLAN_COUNTING_MODEL.md` Milestones 1–3).
- `data/` — generated cards, level limits and `held.generated.ts` (cards the table must not show because an effect cannot be counted, per `docs/adr/0005`; the page leaves these cards out) and `scores.generated.json` (what the page publishes for every other card, the baseline of `scripts/check-score-stability.ts`); `data/scenarios/` (one file per scenario with its route profiles — occasions, filters, optional conditions, lesson splits and the パラメータボーナス base — plus golden and real-data tests).
- `src/engine/` — pure scoring engine (`score.ts`, `count.ts`, `types.ts`), no DOM, dependencies passed in. `count.ts` turns an effect's trigger into occurrences per run: the occasion's count, narrowed by each filter (the lesson-stat filter by the lesson split, the others by the profile) and by each condition the profile states, capped by the effect's own cap, and 0 when the trigger belongs to another scenario (per `docs/adr/0004`).
- `scripts/images/` — Python (uv) image pipeline: `extract.py` downloads card art through a pinned, gitignored GkmasObjectManager checkout and writes 192 × 108 webp thumbnails, `upload.py` sends the ones the deployed site lacks to R2; rules live in pure tested modules (`thumbnail.py`, `decode.py`, `uploads.py`). Setup, commands and the reasons are in `scripts/images/README.md` (per `docs/adr/0003` and plan decisions D30–D32).
- `infra/worker/` — the Cloudflare Worker for `gakumas-supportcards.tia.run`: static assets from `dist/` plus `/img/*` from the R2 bucket `tia-assets` (`img.ts`, `worker.ts`, `wrangler.toml`); deploy and verify steps in `infra/worker/README.md`.
- `src/app/` — the Preact page, entered from `index.html` → `src/main.tsx`: pure `url-state.ts` (view state ⇄ query string), `rows.ts` (score, filter, sort), `panel.ts` (the model of the 「カウントを調整」 panel: four fixed sections, filters and conditions nested under and bounded by what they narrow, inputs folded when no card in view reacts to them, and `applyOverrides`) and `count-labels.ts` (Japanese names for occasions, filters and conditions, also used to word the breakdown), each with tests, and the components that render them (first plan Milestone 3; `docs/plans/EXECPLAN_COUNTING_MODEL.md` Milestone 3, decisions C6, C10, C18, C19). Count overrides live in the URL as `o.<Occasion>`, `f.<Occasion>.<family>.<member>` and `w.<condition key>`. The generated card data ships inline in the bundle (56 KB gzipped, first plan decision D28).

## Setup and Development

- Runtime and package manager: Bun. `bun install` installs the dev dependencies (`js-yaml`, `typescript`, type packages). Inside a sandbox that blocks `~/.bun`, run it as `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache" bun install`.
- Upstream game data is the `vertesan/gakumasu-diff` YAML dump. Scripts read each table from `.cache/gakumasu-diff/<Table>.yaml` when present and otherwise fetch `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` and cache it there; `.cache/` is gitignored, delete it to force a refresh.

## Build and Test

- `bun run dev` — Vite dev server at `http://localhost:5173`; `bun run build` writes `dist/`; `bun run preview` serves it. Thumbnails resolve to `/img/*`: in production the Worker serves them from R2 (per `docs/adr/0003`); the dev server serves them from `scripts/images/out/webp` when the images have been extracted locally, and otherwise the cells fall back to the card name.
- `bun run generate` — runs `scripts/generate-cards.ts`, rewriting `data/cards.generated.ts`, `data/held.generated.ts`, `data/levelLimits.generated.ts` and `data/scores.generated.json` from the cached tables and the shipped scenarios. Output is deterministic (no timestamps), so a second run yields no diff. An effect that cannot be counted does not stop the run: its card is listed in `data/held.generated.ts` with the reason and the effect is left out of the card — a trigger piece of unknown kind (including an unknown `for_` scenario token), an effect type that is neither a parameter type nor audited as non-parameter, or a trigger that needs an occasion or filter number some shipped route profile lacks. The page shows only cards that are not held. Exits 1 without writing when the dump itself looks broken: a schema error, an unknown enum value, item effect type or event reward resource, a dangling id, a skill that grants a P-item, or a card count that would drop (`--allow-fewer` overrides the last). `GAKUMASU_DIFF_CACHE=<dir>` points the generators at another table directory.
- `bun scripts/check-score-stability.ts [--base <git ref> | --base-file <path>]` — the check that replaces a person reading a data update's diff (per `docs/plans/EXECPLAN_COUNTING_MODEL.md` decision C20): recomputes every published score from the working tree and compares with `data/scores.generated.json` as committed at the ref (default `HEAD`); exits 1 when a card whose generated record is unchanged scores differently, or when the working tree's snapshot is stale. A deliberate route-profile or engine change fails it by design: review the listed moves, then commit the regenerated snapshot.
- `bun run type-check` — `tsc --noEmit` over `src/`, `scripts/`, `data/`, `infra/` and `vite.config.ts`.
- `uv run pytest` in `scripts/images/` — hermetic tests of the image pipeline rules (naming, thumbnail format, Unity-version fallback, upload planning, released-cards-only); needs `uv sync` first, no network and no vendored checkout.
- `bun test` — unit tests, co-located as `*.test.ts`: the Worker's image handler against a fake bucket (`infra/worker/img.test.ts`), generator rules against small fixtures (`scripts/lib/`), the scoring engine against fixture cards (`src/engine/score.test.ts`, `src/engine/count.test.ts`), the panel model and URL state (`src/app/`), a real-data check that every shipped route profile names every occasion and filter the generated cards use (an omitted one would silently score 0, so 0 must be written), keeps every filter and condition count within its occasion, and scores all cards finitely (`data/scenarios/scenarios.test.ts`), and golden scores over frozen copies of ten cards, so a game rebalance cannot fail them (`data/scenarios/golden.test.ts` with `golden.snapshot.ts`, per `docs/plans/EXECPLAN_COUNTING_MODEL.md` decision C8).

## Code Style

<!-- Language-specific conventions, naming patterns, import ordering, or formatting tools in use. -->

## Commit Discipline

- Follow Git-flow workflow to manage the branches
- Use small, frequent commits rather than large, infrequent ones
- Only add and commit affected files; leave untracked files as they are
- Never add coding agent attribution in commits

