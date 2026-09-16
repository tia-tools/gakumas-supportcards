# Build the サポカ凸別点数一覧: a scenario-driven support card score table

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/PLANS.md` at the repository root.


## Purpose / Big Picture


A player of 学園アイドルマスター (Gakuen Idolmaster, "gakumas") choosing which support cards to bring into a produce run, or deciding which card is worth spending limit-break resources on, wants one glance at "how many parameter points does this card give me at each limit-break level in the scenario I am playing". Today that question is answered by hand-made spreadsheets, a YouTube video, and a third-party search tool with a manual calculator. After this plan, opening `https://gakumas-supportcards.tia.run` shows a table: one row per support card with its thumbnail (the card name appears on hover), five columns of 点数 for 凸0 to 凸4, filters for card type (Vo/Da/Vi/Assist), plan (センス/ロジック/アノマリー/共通) and rarity, sortable by any 凸 column, with a scenario switcher whose default is H.I.F. and whose second entry is 初LEGEND. The numbers are recomputed from the game's data dump every week without anyone typing card values, and the thumbnails come from an image library we own.

The user can see it working by opening the page, choosing H.I.F., sorting by 凸4, and seeing SSR cards with SP-lesson effects at the top; hovering a thumbnail shows the card name; hovering a number shows its breakdown (skills, events, P-item); switching to 初LEGEND changes every number; the folded 「カウントを調整」 panel lets them change how many SP lessons the route assumes and watch the numbers follow.


## Progress


- [x] (2026-09-16) Design settled in a grill-me session; twelve decisions recorded in the Decision Log below. Repository scaffolded from `Taka499/project-template@b52b8df`.
- [x] (2026-09-16) Three ADRs written: `docs/adr/0001` (score definition), `docs/adr/0002` (taxonomy), `docs/adr/0003` (image library).
- [ ] Milestone 0: prototype the data join for two known cards and prove every effect classifies.
- [ ] Milestone 1: generators and committed data (`data/cards.generated.ts`, `data/taxonomy.generated.ts`, `data/levelLimits.generated.ts`).
- [ ] Milestone 2: scoring engine with two scenario data files; golden tests.
- [ ] Milestone 3: table UI with thumbnails, filters, sort, breakdown, scenario switcher, folded customize panel.
- [ ] Milestone 4: image extraction pipeline and R2 upload; Worker serving static site + `/img/*`.
- [ ] Milestone 5: weekly GitHub Action (regenerate, test, guard, PR, upload new images).
- [ ] Milestone 6: in-app feedback form → Worker `/feedback` → private `tia-tools/feedback` issues.


## Surprises & Discoveries


- Observation: The previous project's generator (`gakumas-hajime-lesson/scripts/generate-supportcards.ts`) silently dropped every HIF-era effect (SP-lesson rate, lesson-end, card-acquisition, card-upgrade, drink triggers) because it mapped only four trigger phase types plus produce-start.
  Evidence: dry run on 2026-09-16 processed 198 of 202 cards but `parseEffectType` recognises only `*Addition` and `*GrowthRateAddition`, and `TRIGGER_TO_ACTIVITY` has four entries; `ProduceTrigger.yaml` has 29 distinct phase types.

- Observation: `ProduceTrigger.yaml` entries carry only `id` and `phaseType`; the condition (SP vs normal lesson, stat ≥ 400, card count ≥ 20, stamina ratio, scenario restriction) is encoded in the id string, e.g. `p_trigger-end_lesson-lesson_dance_sp-dance-0400_0000`, `p_trigger-start_audition-for_hif_memory`.
  Evidence: `curl .../ProduceTrigger.yaml | awk` on 2026-09-16 printed two-field records.

- Observation: `SupportCard.yaml` has no field linking a card to the P-item it grants. hatsuboshi-library derives it from `ProduceEventSupportCard.yaml` → `ProduceStepEventDetail.yaml` → a `produceEffectIds` entry of the form `p_effect-produce_reward-0001_0001-produce_item-pitem_00-3-028-0-0`.
  Evidence: `event-detail-s_card-3-0016-01` has exactly that effect and a description text 「みんなの教科書」「を獲得」.

- Observation: `ProduceStepLessonLevel.yaml` does not contain parameter gain values (fields are `progressLevel`, `limitTurn`, `successThreshold`, `resultTargetValueLimit`), so per-lesson gains in a route profile must come from play knowledge or the wiki, not from the dump.
  Evidence: first record printed on 2026-09-16.


## Decision Log


- Decision: A point (点) is the expected total Vo+Da+Vi parameter gained from one card over one run of the target scenario under a fixed reference route. Lesson-bonus percentages convert through the route's lesson gains. Effects that give P-points, stamina, or card manipulation score 0.
  Rationale: This is what players already mean by サポカ点数, and it makes the score a pure function of card data × route profile, so a new scenario is a new profile rather than new code. Rejected: hand-tuned weights (opinion), full simulation (needs an engine per scenario).
  Date/Author: 2026-09-16 / user, grill-me session (D1). Recorded as `docs/adr/0001`.

- Decision: Reference routes are curated named profiles shipped as data per scenario (for H.I.F. at least 差し入れ育成 and お出かけ育成). The table shows one profile as-is; a folded panel lets a user override individual counts locally in the browser.
  Rationale: Comparable numbers between users by default, flexibility for those who want it. Rejected: deriving counts from game tables (player choice dominates the real counts).
  Date/Author: 2026-09-16 / user (D2).

- Decision: The effect taxonomy is the game's own `SupportCardProduceSkillFilter.yaml` (46 rows today), keyed by its row id, titles taken from data. A route profile assigns a count per row id. A card effect matching no row fails the generator.
  Rationale: New categories arrive with the weekly pull; labels match the in-game filter UI. Rejected: own categories, mirroring gakumasu.site.
  Date/Author: 2026-09-16 / user (D3). Recorded as `docs/adr/0002`.

- Decision: The reference route assumes every lesson taken is an SP lesson. Therefore SPレッスン発生率+ scores 0, 通常レッスン終了時 categories have count 0, and both レッスン終了時 (any) and SPレッスン終了時 categories receive the SP-lesson counts. パラメータボーナス+ (percent) converts as percent × the sum of the route's SP-lesson gains for that stat.
  Rationale: User's call; mirrors how strong players actually route. Rejected: modelling SP rate as marginal extra SP lessons, deck synergy, empirical constants.
  Date/Author: 2026-09-16 / user (D4).

- Decision: v1 ships two scenarios as data files: H.I.F. (default) and 初LEGEND. A scenario switcher is visible from day one.
  Rationale: A second real scenario is the only honest proof the abstraction works; 初LEGEND numbers already exist in the sibling project. Rejected: HIF only; adding N.I.A. (fresh research).
  Date/Author: 2026-09-16 / user (D5).

- Decision: Thumbnails come from an owned image library: extracted from the game CDN, downscaled webp named `img_general_{assetId}_full.webp`, stored in a Cloudflare R2 bucket bound to this app's Worker, served at `/img/*`. hatsuboshi-library was investigated at the user's request and found to hold no images in git (its prefix is a private Cloudinary account).
  Rationale: Same Cloudflare account and wrangler workflow as `gakumas-rehearsal-automation`; keeps one subdomain per app; free at this size; reusable by future tia-tools apps. Rejected: git image repo + Pages, bundling into `public/`, own Cloudinary, hotlinking.
  Date/Author: 2026-09-16 / user after a four-option comparison (D6). Recorded as `docs/adr/0003`.

- Decision: Hosting is a Cloudflare Worker with static assets at `gakumas-supportcards.tia.run`. v1 carries only the in-app feedback form of the tia-tools conventions (Worker `/feedback` → labeled issues in private `tia-tools/feedback`, own least-privilege PAT). No metrics, no release signing.
  Rationale: The feedback route exists as a pattern in `gakumas-rehearsal-automation/infra/worker/worker.js`; metrics can wait for traffic; there are no binaries to sign.
  Date/Author: 2026-09-16 / user (D7).

- Decision: Single app repository `tia-tools/gakumas-supportcards` holding `src/` (engine + UI), `scripts/` (Bun generators and the Python image extractor), `data/` (generated TypeScript, committed), `infra/worker/`. One weekly GitHub Action opens one PR for data changes and uploads new images to R2.
  Rationale: One job, one PR to review; split into a shared data package only when a second tool needs it.
  Date/Author: 2026-09-16 / user (D8).

- Decision: UI is one row per card, columns 凸0..凸4; thumbnail with name on hover plus rarity/plan badges; filters type/plan/rarity; sort by any 凸 column, default 凸4 descending; scenario and route-profile switcher at the top; customize-counts panel folded. Stack: Vite + Preact + Tailwind CSS v4 + Bun, tests with `bun test` (assumption stated, not objected).
  Rationale: This is the 凸別 view players ask for; static numbers keep the page instant.
  Date/Author: 2026-09-16 / user (D9).

- Decision: Cards with no parameter effect stay listed with 0 in every column and a 「パラメータ効果なし」 tag, sorted last. Conditional triggers are treated as always satisfied (maximum performance). No fulfilment ratios.
  Rationale: Hiding cards reads as missing data; maximum performance is the community's de facto standard and needs no extra knobs.
  Date/Author: 2026-09-16 / user (D10).

- Decision: P-items granted by a support card count: their parameter effects × the item's trigger limit, shown as a separate breakdown part. The join stays level-aware even though no 凸-dependent item upgrade exists today.
  Rationale: The item is part of what the card brings; its trigger count is fixed data.
  Date/Author: 2026-09-16 / user (D11).

- Decision: Support-card events count: parameter rewards of each event unlocked at the card's level (events unlock at level 1 and level 20) × 1 per run. Item, card and P-point rewards score 0 in this part.
  Rationale: An event fires once per run; fixed data, no route assumption.
  Date/Author: 2026-09-16 / user (D12).


## Outcomes & Retrospective


Nothing implemented yet. To be written at each milestone's end.


## Context and Orientation


This repository was created on 2026-09-16 from the `Taka499/project-template` scaffold and contains only `CLAUDE.md`, `docs/PLANS.md`, `docs/adr/`, and this plan. Everything else described below does not exist yet.

Terms used throughout, in plain language:

A support card (サポカ) is a card a player equips before a produce run. It has a type (Vocal, Dance, Visual, or Assist), a rarity (R, SR, SSR), a plan restriction (common, or one of センス/ロジック/アノマリー, which the data calls `Plan1/Plan2/Plan3` or `Sense/Logic/Anomaly`), a level, and a set of support skills whose effects fire on triggers during the run. A parameter is one of the three idol stats Vocal, Dance, Visual; "parameter gain" is how much those stats grow.

凸 (totsu, limit break) is the number of duplicate copies merged into a card, 0 to 4. Each 凸 raises the card's maximum level. The data gives this in `SupportCardLevelLimit.yaml` as rank `SupportCardLevelLimitRank_Unknown` (凸0) and `__1` to `__4`, with `levelLimit` values R 20/25/30/35/40, SR 30/35/40/45/50, SSR 40/45/50/55/60. "Points at 凸k" means points with the card at level `levelLimit[k]`.

A breakpoint is a card level at which a skill's effect values change. Skill values are stored per skill level, and `SupportCardProduceSkillLevel{Vocal,Dance,Visual,Assist}.yaml` says which skill level a card has at which card level. Resolving a card at level L means, for each skill, taking the row with the highest `supportCardLevel <= L`.

An SP lesson is a special lesson variant that gives roughly 1.5× the parameters of a normal lesson and that many support skills react to specifically. The reference route in this project assumes every lesson is an SP lesson (Decision D4).

A route profile is a small data object describing one way of playing a scenario: how many times each taxonomy category's trigger occurs in a run, and the parameter gain of each SP lesson per stat (needed to convert percentage bonuses). A scenario is a data object holding an id, a display name, the parameter cap, and one or more route profiles.

The taxonomy is the list of effect categories. It comes from `SupportCardProduceSkillFilter.yaml`, whose rows look like this (indented, abridged):

    - id: s_card_p_skill_filter-lessonvocalspchangeratepermiladdition-p_trigger-produce_start-no_description
      title: SPレッスン発生率+
      order: 3
      produceEffectTypes:
      - ProduceEffectType_LessonVocalSpChangeRatePermilAddition
      - ProduceEffectType_LessonSpChangeRatePermilAddition
      - ProduceEffectType_LessonDanceSpChangeRatePermilAddition
      produceTriggerIds: ...

A card skill effect belongs to the first row whose `produceEffectTypes` contains the effect's type and whose `produceTriggerIds` contains the effect's trigger id. The 46 titles as of 2026-09-16, in `order`, include 初期パラメータ上昇 (1), パラメータボーナス+ (2), SPレッスン発生率+ (3), レッスン終了時パラメータ上昇 (4), 通常レッスン終了時パラメータ上昇 (5), SPレッスン終了時パラメータ上昇 (6), スキルカード強化時/削除時/チェンジ時/獲得時 variants (7–23), 授業・営業終了時 (24), 試験・オーディション終了時 (25), 活動支給・差し入れ選択時 (26), おでかけ終了時 (27), 相談選択時 (28), 相談でPドリンク交換後 (29), 休む選択時 (30), Pドリンク獲得時 (31), and a tail of stamina, P-point and conditional variants such as SPレッスン終了時所持スキルカードが20枚以上の場合パラメータ上昇 (36).

The upstream data is the GitHub repository `vertesan/gakumasu-diff`, a dump of the game's master tables as YAML, updated every few days (commits on 2026-09-10 and 2026-09-15). Files are fetched raw from `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml`. The tables this plan uses: `SupportCard.yaml` (card identity; fields `id`, `name`, `type`, `rarity`, `planType`, `assetId`, `supportCardLevelLimitId`), the four `SupportCardProduceSkillLevel*.yaml` (card level → skill level), `ProduceSkill.yaml` (skill id + level → up to three `produceEffectIdN`/`produceTriggerIdN` pairs), `ProduceEffect.yaml` (`produceEffectType`, `effectValueMin`, `effectValueMax`), `ProduceTrigger.yaml` (`phaseType`; conditions only in the id string), `SupportCardProduceSkillFilter.yaml` (taxonomy), `SupportCardLevelLimit.yaml` (凸 → level), `ProduceEventSupportCard.yaml` and `ProduceStepEventDetail.yaml` (card events, their unlock level, their effect ids including the granted P-item), and `ProduceItem.yaml` plus its effect/trigger tables (the granted item's parameter effects and trigger limit; the exact fields are to be discovered in Milestone 0). Percent-type effects (`*GrowthRateAddition`) are stored in tenths of a percent (85 means 8.5%); permil types are in thousandths.

Scenario facts known today: H.I.F. is `ProduceGroup.yaml` row `produce_group-003`, name 『Hatsuboshi IDOL FESTIVAL』, `ProduceType_HatsuboshiIdolFestival`, produces `produce-007` (選抜試験) and `produce-008` (本戦), parameter cap 3000 (community source, to be confirmed against `ProduceSetting.yaml` in Milestone 2). 初LEGEND is `produce-006` in `produce_group-001`, 18 weeks, cap 2800, with Legend lessons at weeks 4, 7, 12, 14, 16 giving (selected / each non-selected) +140/+55, +180/+60, +260/+70, +370/+90, +570/+115 at perfect clear, and regular lessons at weeks 1, 2, 6, 15 giving +100, +100, +150, +200 to the selected stat only; outings at weeks 3, 5, 11, 13; consultations at 5, 8, 13, 17; 活動支給 at 3, 5, 11, 13; rest at 3, 5, 11, 13, 17; special training at 9 and 17. These numbers were verified against the community wiki in the sibling project `gakumas-hajime-lesson` (`_docs/DATA_COLLECTION.md`, `src/engine/constants.ts`) and are repeated here so this plan stands alone. Whether 初LEGEND lessons count as "SP" for trigger purposes must be settled in Milestone 2 (see its open question).

The sibling project `gakumas-hajime-lesson` (a local checkout next to this repository, also on GitHub under `Taka499`) contains a working 4-table generator that this plan re-implements with the taxonomy instead of a hand mapping; its `scripts/generate-supportcards.ts` is worth reading once for the YAML field names but should not be copied, because its trigger mapping is the very thing being replaced.

The deployment target follows the conventions of `Taka499/gakumas-rehearsal-automation` (ADRs 0011, 0014, 0015 there): every tia-tools app gets a single-level subdomain of `tia.run` served by its own Cloudflare Worker defined in `infra/worker/wrangler.toml` with `routes = [{ pattern = "<app>.tia.run", custom_domain = true }]`; the Worker for that project already implements a `POST /feedback` handler that creates an issue in the private `tia-tools/feedback` repository using a fine-grained PAT stored as the wrangler secret `FEEDBACK_TOKEN`. R2 is Cloudflare's object storage; a bucket is bound to a Worker in `wrangler.toml` under `[[r2_buckets]]` and read in code via `env.<BINDING>.get(key)`.


## Plan of Work


The work is arranged so that each milestone leaves something a person can run and inspect, and so that the parts with unknowns (the data join, the image extraction) come before the parts that depend on them.

Milestone 0 is a throwaway prototype: a single Bun script that fetches the tables, joins them for two cards whose in-game values are known, prints every effect with its classified taxonomy row, and lists any effect it could not classify. Its success criterion is "zero unclassified effects across all cards, and the two cards' printed values match the game". It also discovers the P-item join path and the event join path, and records the exact field names in this plan.

Milestone 1 turns the prototype into two generators under `scripts/` producing committed TypeScript under `data/`: `cards.generated.ts` (one record per card with its 凸-independent identity plus, per breakpoint level, a list of classified effects: taxonomy row id, stat, value, and kind `skill|event|item`), `taxonomy.generated.ts` (the filter rows with titles and order), and `levelLimits.generated.ts` (rarity → 凸 → level). The generators fail with a non-zero exit when any effect is unclassified, when the card count decreases versus the committed file, or when an enum value is unknown. Unit tests cover the classification and breakpoint resolution.

Milestone 2 writes the engine in `src/engine/` with no DOM imports: `Scenario` and `RouteProfile` types, `resolveAtLevel(card, level)`, `score(card, totsu, scenario, profile)` returning `{ total, byStat, parts }`, and two scenario files `data/scenarios/hif.ts` and `data/scenarios/hajime-legend.ts`. The H.I.F. route counts are the user's play knowledge and must be entered by the user or confirmed by them; the plan carries them once entered. Golden tests pin a handful of cards' 凸4 scores after the user has confirmed them against community numbers.

Milestone 3 builds the page: Vite + Preact + Tailwind v4, one `<table>` with sticky header, thumbnail cell using `IMG_PREFIX + "img_general_" + assetId + "_full.webp"`, filters, sort, tooltip breakdown, scenario and profile `<select>`s, and a `<details>` element holding the count overrides. All state lives in the URL query string so a filtered, sorted view is shareable.

Milestone 4 owns the images: a Python project under `scripts/images/` (managed with `uv`) using GkmasObjectManager to fetch assets matching `img_general_csprt-.*_full`, resize to 192 px wide webp, and upload only missing keys to the R2 bucket; and the Worker under `infra/worker/` serving the built site as static assets, `/img/*` from R2 with `Cache-Control: public, immutable, max-age=31536000`, and `/feedback`.

Milestone 5 adds `.github/workflows/update-data.yml`: weekly, regenerate, run tests, run guards, open a PR if `data/` changed, and upload new images for any `assetId` not yet in the bucket. Milestone 6 adds the feedback form to the page.


## Concrete Steps


Milestone 0, working directory `/Users/ghensk/Developer/gakumas-supportcards`:

    bun init -y
    bun add -d js-yaml @types/js-yaml @types/bun typescript
    bun scripts/prototype-join.ts s_card-3-0016 s_card-3-0073

Expected transcript shape:

    Fetched 12 tables (SupportCard 202 rows, ProduceSkill N rows, ...)
    s_card-3-0016 1人たりとも欠ける事なく  SSR vocal common  levelLimit: 40/45/50/55/60
      level 60: [初期パラメータ上昇] vocal +35 (skill)  ...
      event lv1: item pitem_00-3-028-0 みんなの教科書 → ...
    Unclassified effects: 0

If `Unclassified effects` is not 0, print each with its effect type and trigger id; the fix is never to drop them but to understand why the filter table has no row (it may be a non-parameter effect the taxonomy legitimately omits, such as `ProduceReward`; those are whitelisted by effect type in one place with a comment).

Milestone 1:

    bun run generate            # runs scripts/generate-cards.ts and scripts/generate-taxonomy.ts
    bun test                    # unit tests under src/**/*.test.ts and scripts/**/*.test.ts

Milestone 2:

    bun test --test-name-pattern "golden"

Milestone 3:

    bun run dev                 # http://localhost:5173

Milestone 4, from `scripts/images/`:

    uv sync
    uv run extract.py --out ./out            # writes img_general_csprt-*_full.webp
    uv run upload.py --bucket tia-assets     # uploads missing keys via the R2 S3 API

and from `infra/worker/`:

    wrangler deploy

Exact commands and transcripts must be updated here as each milestone is executed.


## Validation and Acceptance


Milestone 0 is accepted when the prototype prints zero unclassified effects over all cards and the two sample cards' values at level 60 equal the in-game display (the user checks in game or against hatsuboshi-library's card page).

Milestone 1 is accepted when `bun run generate` is idempotent (second run produces no diff), `bun test` passes, and deliberately corrupting the taxonomy file (delete one row) makes the generator exit non-zero naming the orphaned effect.

Milestone 2 is accepted when `score()` for a card with only an SP発生率 skill returns 0 in every 凸, a card with only P-point skills returns 0 with `parts` empty, and the golden cards match the numbers the user confirmed; and when switching the scenario argument from `hif` to `hajimeLegend` changes the totals without any code change.

Milestone 3 is accepted when the page at `http://localhost:5173` shows all cards, sorts by each 凸 column, filters by type/plan/rarity, shows the name on thumbnail hover, shows the breakdown on number hover, and reloading a URL with query parameters restores the same view.

Milestone 4 is accepted when `https://gakumas-supportcards.tia.run/` serves the page and `https://gakumas-supportcards.tia.run/img/img_general_csprt-3-0016_full.webp` returns HTTP 200 with `content-type: image/webp` and an immutable cache header.

Milestone 5 is accepted when a manual `workflow_dispatch` run on `main` produces either "no changes" or a PR touching only `data/`, and the PR's checks include the test run.

Milestone 6 is accepted when submitting the form creates an issue in `tia-tools/feedback` labelled `gakumas-supportcards`.


## Idempotence and Recovery


Generators overwrite their outputs wholesale and are safe to rerun; `git diff data/` is the review surface. The image upload script lists bucket keys first and uploads only missing ones, so a failed run is resumed by rerunning. `wrangler deploy` is idempotent. Nothing in this plan writes to the sibling repository.


## Artifacts and Notes


To be filled with transcripts as milestones complete. The grill-me session's raw decision log was kept at `$TMPDIR/grill-me-supoka-decisions.md` on 2026-09-16 and is fully transcribed into the Decision Log and Context sections above.


## Interfaces and Dependencies


Runtime and tooling: Bun (scripts, tests, package manager), Vite 7, Preact 10, Tailwind CSS v4 via `@tailwindcss/vite`, `js-yaml` for the generators, `uv` + GkmasObjectManager (GPL-3) for image extraction only (it never ships in the web bundle), `wrangler` for the Worker.

In `src/engine/types.ts`, define:

    export type Stat = "vocal" | "dance" | "visual";
    export type Totsu = 0 | 1 | 2 | 3 | 4;
    export interface ClassifiedEffect {
      categoryId: string;          // SupportCardProduceSkillFilter row id
      stat: Stat;
      value: number;               // flat points, or percent for パラメータボーナス+
      kind: "skill" | "event" | "item";
      triggerLimit?: number;       // items only
    }
    export interface Breakpoint { minLevel: number; effects: ClassifiedEffect[] }
    export interface Card {
      id: string; name: string; assetId: string;
      type: Stat | "assist"; rarity: "r" | "sr" | "ssr";
      plan: "common" | "sense" | "logic" | "anomaly";
      breakpoints: Breakpoint[];
    }
    export interface RouteProfile {
      id: string; name: string;
      counts: Record<string, number>;          // categoryId -> occurrences per run
      spLessonGain: Record<Stat, number>;      // parameter gain of one SP lesson, per stat, summed over the run's lessons of that stat
    }
    export interface Scenario { id: string; name: string; parameterCap: number; profiles: RouteProfile[] }
    export interface ScoreParts { skills: number; events: number; items: number }
    export interface Score { total: number; byStat: Record<Stat, number>; parts: ScoreParts }

In `src/engine/score.ts`, define:

    export function levelFor(rarity: Card["rarity"], totsu: Totsu): number;
    export function resolveAtLevel(card: Card, level: number): ClassifiedEffect[];
    export function score(card: Card, totsu: Totsu, scenario: Scenario, profile: RouteProfile): Score;

`score` sums, over resolved effects: for `kind === "skill"` with a percent category, `value/100 × profile.spLessonGain[stat]`; for other skills, `value × (profile.counts[categoryId] ?? 0)`; for events, `value`; for items, `value × triggerLimit`. Categories the profile does not name count 0; the generator's taxonomy test asserts every category id in every shipped profile exists in the taxonomy, so a typo fails the build.

Open question carried to Milestone 2: whether 初LEGEND Legend lessons should be treated as SP lessons for trigger purposes (they are a distinct lesson kind in that scenario). Resolve with the user before writing `hajime-legend.ts`; record the answer in the Decision Log.
