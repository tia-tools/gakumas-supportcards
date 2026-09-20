# Count occasions, filters and conditions instead of one number per filter-table row

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/PLANS.md` at the repository root.

Design confirmed by the user on 2026-09-21; implementation has not started and waits for the user's go-ahead (see Progress).


## Purpose / Big Picture


The サポカ凸別点数一覧 (this repository's support card score table for 学園アイドルマスター, described in `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`) turns each card effect into points by multiplying its value by how often its trigger happens in one run of a scenario. Today "how often" is one hand-entered number per row of the game's card-filter table, 41 numbers per route profile, shown to the player as a flat grid under 「カウントを調整」. That has three costs the user named on 2026-09-20 and 2026-09-21. First, the weekly data update cannot run unattended: whenever the game adds a filter row, or a card uses a row no profile counts, a person must write numbers into every profile before anything can publish. Second, conditional effects cannot be expressed honestly: the card こんにゃくなきもだめし gains Vocal +15 after an SP lesson only when the deck holds 20 or more skill cards, which is easy on one route and hard on another, yet the model can only treat it as a free-standing count that ignores how many SP lessons there are. Third, the panel is too crowded to read.

After this plan, a route profile states how often each kind of thing happens in a run (an occasion), which share of those occasions a filter selects, and how many of them meet a condition, with every condition defaulting to "always met". The player sees a short nested panel in which a condition sits under its occasion and cannot exceed it. A data update that only adds new filters or conditions on known occasions needs no human input at all.


## Progress


- [x] (2026-09-21) Design interview started (`grill-me`). Facts gathered from the game data before the first question: 81 parameter-bearing triggers reduce to 19 phase types (see Surprises & Discoveries).
- [x] (2026-09-21) Design interview: decisions C0–C9 recorded; ADR 0004 (counting model, supersedes 0002), ADR 0005 (never publish an unscoreable number) and an addendum to ADR 0001 written; `CLAUDE.md` index updated.
- [x] (2026-09-21) The user confirmed that this plan reflects the shared understanding, and asked that implementation not start yet. The next session begins at Milestone 0 only when the user says so.
- [ ] Milestone 0: prototype trigger parser over the real data; equivalence table from today's counts to the new profile fields; find where skill description text lives for labels.
- [ ] Milestone 1: generators emit occasions, filters and conditions; shape rules and the hidden-card list.
- [ ] Milestone 2: new engine beside the old one, profiles restated, 816-row equivalence test, goldens on a frozen snapshot, old engine and taxonomy extensions removed.
- [ ] Milestone 3: the four-section panel with nested bounded inputs, folding, and new URL keys.
- [ ] Milestone 4: update gates — hidden cards, score-stability check — ready for the first plan's weekly action.


## Surprises & Discoveries


- Observation: The game data already says which kind of thing each trigger reacts to. Every row of `ProduceTrigger.yaml` has exactly two fields, `id` and `phaseType`. Across all support card skills and all P-items granted by card events, 81 distinct triggers carry a Vocal, Dance or Visual effect, and they belong to only 19 phase types: `BuyShopItemProduceCard`, `BuyShopItemProduceDrink`, `ChangeProduceCard`, `CustomizeProduceCard`, `DeleteProduceCard`, `EndAudition`, `EndBeforeAuditionRefresh`, `EndLesson`, `EndStepEventActivity`, `EndStepEventSchool`, `GetProduceCard`, `GetProduceDrink`, `GetProduceItem`, `ProduceStart`, `StartCustomize`, `StartPresent`, `StartRefresh`, `StartShop`, and `EndLessonBeforePresent` (the last carries no parameter effect today). `GetProduceCard` alone accounts for 29 of the 81 triggers and `EndLesson` for 15.
  Evidence: a throwaway `bun -e` script over `.cache/gakumasu-diff/` on 2026-09-21 printed `parameter-bearing triggers: 81 | event kinds: 19`.

- Observation: Everything in a trigger id after the phase is one of a small vocabulary of segments. Segments that select which occurrences qualify: `lesson_{vocal,dance,visual}` with optional `_sp` or `_normal`, `lesson_sp`, `p_card_search-{deck_all,mental_skill,active_skill,ssr,…-starter}`, `effect_group-visible-exam_{parameter_buff,lesson_buff,card_play_aggressive,review,concentration,full_power,preservation,block}`. Segments that require a state of the run: `{vocal,dance,visual}-{0400,0700,0900}_0000` (that stat at or above the number), `stamina_ratio-0500_0000` (stamina at half or more), `produce_card_count-0020_0000` (deck of 20 or more), `produce_card_search_count-…-{0008,0015}_0000` (that many matching cards held). One segment restricts the scenario: `for_hajime_legend_ssr` on `get_produce_card-produce_card_count-0017_0000-for_hajime_legend_ssr`.
  Evidence: the same script's grouped listing, 2026-09-21.

- Observation: gakumasu.site, the community tool the user named as the model for a readable panel, groups its calculator inputs by what happens in a run — lessons, actions outside lessons, skill card operations, other — and lists "SP lessons with 20 or more cards" inside the lessons group as its own input.
  Evidence: a machine summary of `https://gakumasu.site/` fetched 2026-09-21; the page is JavaScript-heavy, so details are approximate and must be checked by eye before copying any layout.


- Observation: Effect-group filters never compete within one run. Every support card whose skill carries an `effect_group-visible-exam_*` filter is restricted to one plan, and the group always belongs to that plan: 好調 (`parameter_buff`, 4 cards) and 集中 (`lesson_buff`, 3) only on センス (`Plan1`) cards; 好印象 (`review`, 8), やる気 (`card_play_aggressive`, 1) and 元気 (`block`, 3) only on ロジック (`Plan2`) cards; 全力 (`full_power`, 1) and 温存 (`preservation`, 9) only on アノマリー (`Plan3`) cards; 強気 (`concentration`) appears only on P-items. No common-plan card uses an effect-group filter. So the nine effect-group numbers of a profile are three small independent sets, one per plan, and the panel can show only the set of the plan being looked at.
  Evidence: a throwaway script joining `SupportCardProduceSkillLevel*.yaml`, `ProduceSkill.yaml` and `SupportCard.yaml` on 2026-09-21 printed exactly one plan per effect group.

## Decision Log


Decisions of this plan are numbered C1, C2, … to keep them apart from the D-numbers of `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`.

- Decision (C0, vocabulary): Three terms replace the single idea of a "category count". An occasion (発動機会) is something that happens in a run — a lesson ends, a skill card is acquired, an audition ends. A filter says which occasions qualify — a Vocal lesson, a mental skill card, a 好印象 card, an SSR card. A condition is a state of the run that must hold at that moment — a deck of 20 or more cards, a stat at 400 or more, stamina at half or more. The word "event" keeps the meaning it already has in this repository: a support card's own サポートイベント (`kind: "event"` in `src/engine/types.ts`), never something that happens in a run.
  Rationale: The agent had been calling run occurrences "events" while the code and the first plan use that word for card events; one word for two things in a scoring engine is a bug waiting to happen.
  Date/Author: 2026-09-21 / agent, proposed at the start of the interview; the user answered the next question in these terms.

- Decision (C1): An occasion is the game's own phase type (`ProduceTrigger.phaseType`), one occasion per phase type, 19 today. It is not a curated list of ours, and it is no longer a row of the card-filter table `SupportCardProduceSkillFilter.yaml`.
  Rationale: Every trigger in the data carries a phase type, so a new trigger under a known phase can be counted without anyone deciding anything; only a brand-new phase type needs a person. A curated list would let play knowledge merge or split phases but would put a mapping decision in front of every new phase. Counting per filter row is what made the update manual and the panel a 41-cell grid. Rejected: our own curated occasion list; keeping per-row counts and only regrouping the panel.
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C2): A condition is expressed as a bounded count: for each condition a profile states how many of its parent occasions meet it, from 0 up to the parent's own count, and the default is the maximum (every occasion meets it), which preserves the "maximum performance" reading of `docs/adr/0001` as the starting point. The panel shows the condition nested under its occasion and cannot let it exceed the parent. Worked example the design must keep true: こんにゃくなきもだめし gives Vocal +15 after an SP lesson when the deck holds 20 or more skill cards, at most 4 times per run; H.I.F. has 8 SP lessons; a deck that reaches 20 cards by the fifth lesson still has four qualifying lessons, the cap of 4 is still reached and the card earns its full 60 points — it loses points only when fewer than four lessons qualify. So the engine takes min(effect cap, qualifying occasions), and "can I reach 20 cards" is the wrong question; "for how many lessons do I have them" is the right one.
  Rationale: A count interacts correctly with per-run caps, cannot express nonsense such as 8 qualifying lessons out of 3 (which today's free-standing numbers allow), and handles conditions that come and go, like stamina at half or more. Rejected: a yes/no switch per condition (a deck that reaches 20 cards halfway can only be all or nothing); "met from the N-th occasion onward" (cannot express conditions that are not monotone and needs the order of occasions, which profiles do not carry).
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C3): A filter is also a bounded count — "of the 20 skill cards acquired, 13 are mental" — but unlike a condition it never defaults to the maximum, because not every occasion matches a filter; the first plan's decision D23 already rejected "every acquired card matches every effect group" as unreal. Filters are organised in families (card type: mental or active; effect group: 好調, 集中, やる気, 好印象, 強気, 全力, 温存, 元気; rarity: SSR; lesson stat; name contains 「基本」). A route profile states one default count per family plus explicit exceptions — for H.I.F. 差し入れ育成 today: effect group 10 with 好印象 14 and 元気 12; mental 13; active 7; SSR 10 — and a new member of a known family (a new effect group arriving with a new plan, say) takes the family default and publishes without any human input. Only a brand-new family comes to the user as a conditional pull request (decision D34 of the first plan).
  Rationale: The family default is the same estimate the user already applies to six of the eight effect groups, so extending it to a ninth is not a new judgment; asking every time would make a new plan wait for a tap, and using the parent's full count would silently overstate scores.
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C4): When the parser meets a piece of a trigger id it has never seen, the piece's shape decides. A piece shaped like a threshold — a name followed by `NNNN_NNNN`, as in `vocal-0400_0000`, `stamina_ratio-0500_0000`, `produce_card_count-0020_0000` — is a condition and is counted at the maximum (C2). A new value in a known filter position (the slot after `p_card_search-`, the slot after `effect_group-visible-`, the lesson slot) is a new member of that family and takes the family default (C3). Anything that fits neither is not counted at all: the card is hidden (decision D33 of the first plan) and the piece comes to the user as a conditional pull request with a proposal (D34).
  Rationale: Every condition seen in the data has the threshold shape and every filter sits in one of a few fixed positions, so shape identifies the kind even for a never-seen member. Counting a new condition at the maximum is exactly the reading `docs/adr/0001` promises, so it is a number the site can stand behind by policy; guessing at a piece of unknown kind is not. Rejected: holding every unseen piece (every new stat threshold on a P-item would wait for a tap); counting every unseen piece at the maximum (a piece that is really a filter would silently overstate the score).
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C5): A `for_{scenario}` piece restricts a trigger to one scenario (`for_hajime_legend_ssr`, `for_hif_memory` exist in `ProduceTrigger.yaml`). The parser maps the known tokens to this repository's scenario ids and counts such a trigger 0 in every other scenario; an unknown `for_` token is of unknown kind and is handled by C4's last rule (hide and ask), never assumed to be 0, because a token for a scenario we do ship but fail to recognise would silently understate a score.
  Rationale: The restriction is a fact in the data, not a judgment; the only judgment is what to do when it cannot be read, and an understated number is as untrustworthy as an overstated one.
  Date/Author: 2026-09-21 / agent.

- Decision (C6): The 「カウントを調整」 panel has a fixed structure of four sections, modelled on how gakumasu.site groups its inputs. スケジュール holds what the scenario fixes (lessons, 授業, auditions, the rest before an audition, the start of the run) as read-only facts, with the number of SP lessons adjustable and conditions such as 所持スキルカード20枚以上 nested under it. 行動 holds the route's choices (差し入れ, おでかけ, 相談, 休む, 特別指導). スキルカード holds acquired, deleted, upgraded, changed and customised cards, each with its filters nested beneath and effect groups shown per plan. ドリンク・アイテム holds drinks acquired, 相談 exchanges and items acquired. An input that no card in the current table view reacts to is folded into one "not used by the cards shown" line per section: still reachable, still applied, still counted in the 変更中 badge. With the table filtered to one plan, only that plan's effect groups stay unfolded.
  Rationale: The user found the 41-cell grid too crowded and pointed at gakumasu.site's grouping. A fixed structure keeps controls from appearing and disappearing as the table is filtered, while folding keeps the panel short; hiding irrelevant inputs completely would let an unseen override keep affecting scores. Rejected: always showing every input (still about 35); hiding unused inputs completely.
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C7): A route profile may ship a lower default for a specific condition (the motivating case: 所持スキルカード20枚以上 under the deletion-heavy 汎用コンテ育成), through an optional per-condition field; a condition the profile does not mention defaults to the maximum. Every shipped profile starts with no such entries, so every condition is at the maximum on day one; the user lowers individual ones later as data edits, which show up as ordinary diffs. When a route's default is below the maximum the panel says so, so nobody wonders why two routes disagree. Deriving fulfilment from deck size over time is rejected: it needs the timing of every acquisition and deletion, which is the simulation `docs/adr/0001` ruled out.
  Rationale: Honest per-route numbers are worth having, but each lowered default is a judgment only the user can supply, so the capability ships now and the judgments arrive when the user is confident. Because "unstated means maximum", a new condition arriving in a data update still needs nothing from anyone.
  Date/Author: 2026-09-21 / user, choosing the agent's recommendation.

- Decision (C8): The migration must change no number. With every condition at the maximum and the filter counts carried over from today's profiles, the new engine has to reproduce all 816 score rows (204 cards × 4 route profiles, each at 凸0–凸4) of the current engine exactly; the old engine stays in the tree next to the new one until a test proves that, and is deleted only afterwards. The nine golden tests move from live data to a frozen snapshot of their nine cards, so that a game rebalance of one of those cards can never block a data update while the engine is fine.
  Rationale: A redesign of how counts are stated is not a reason for any published number to move; an exact-equivalence test turns "is this a safe rewrite" from a hope into a check. Goldens pin engine behaviour, not game data, so they should not depend on game data.
  Date/Author: 2026-09-21 / agent.

- Decision (C9): This plan lands before Milestone 5 (the weekly GitHub Action) of `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`, because what that action may publish by itself and what it must hold is defined by this model. Milestone 4 of that plan (image library and Worker deployment) is independent and can proceed in parallel. The Discord approval service of decision D34 lives in its own repository and blocks nothing here.
  Rationale: Automating the current model would automate its manual stops.
  Date/Author: 2026-09-21 / agent.


## Outcomes & Retrospective


Nothing to report yet.


## Context and Orientation


This repository builds a static page that lists every 学園アイドルマスター support card with its 点数 at 凸0 to 凸4. A 点数 is the Vocal + Dance + Visual parameter a card is expected to add over one run of a scenario (`docs/adr/0001`). The first plan, `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`, built the pipeline this plan changes; a reader does not need to read it, because what matters is repeated here.

Game data comes from the `vertesan/gakumasu-diff` YAML dump, cached under `.cache/gakumasu-diff/`. `bun run generate` runs `scripts/generate-taxonomy.ts` and `scripts/generate-cards.ts` over the shared library `scripts/lib/` (`tables.ts` loads tables, `classify.ts` assigns each effect to a category, `build-cards.ts` builds per-card breakpoints, `emit.ts` writes files) and rewrites `data/taxonomy.generated.ts`, `data/cards.generated.ts` and `data/levelLimits.generated.ts`. A card effect in the generated data (`ClassifiedEffect` in `src/engine/types.ts`) carries a `categoryId`, a stat, a value, a kind (`skill`, `event` for the card's own サポートイベント, or `item` for a P-item the card grants), an optional per-run `cap`, and an optional `triggerStat` when its trigger is bound to lessons of one stat.

Today a category is a row of the game's card-filter table `SupportCardProduceSkillFilter.yaml` (49 rows) or one of four hand-written rows in `data/taxonomy.extensions.ts` for triggers the game table lacks; a trigger id not listed verbatim is matched to the row whose trigger id is its longest `-`-delimited prefix. A scenario file (`data/scenarios/hif.ts` with three route profiles 差し入れ育成, おでかけ育成, 汎用コンテ育成; `data/scenarios/hajime-legend.ts` with one) gives each profile `counts`, a map from category id to occurrences per run (about 41 entries), `lessonSplits` (six presets of how many of the run's lessons train each stat) and `parameterBonusBase`. The engine `src/engine/score.ts` multiplies each effect's value by min(its cap, the category's count, the lessons of its `triggerStat`) and `scoreBest` picks the lesson split that scores a card best. The page under `src/app/` lets the player override counts in the folded 「カウントを調整」 panel (`CustomizePanel.tsx`), a flat grid of those 41 numbers, and keeps overrides in the URL (`url-state.ts`, keys `c.<short category id>`).

What is wrong with that, and why it cannot be patched: the filter table is a search aid for browsing cards, not a model of a run. It flattens three different things into sibling rows — what happens (a lesson ends), which occurrences qualify (a Vocal lesson, a 好印象 card) and what state must hold (a deck of 20 or more). On 2026-09-20 a routine data update stopped three times for hand edits that carried no judgment: two extension rows became redundant when the game added its own rows under new ids, and two new "8枚以上" rows needed counts copied from their unconditional siblings into all four profiles. The vocabulary this plan uses instead — occasion, filter, condition — is defined in decision C0.


## Plan of Work


The work is ordered so that the unknowns are met first and no published number moves at any step.

Milestone 0 is a throwaway prototype, `scripts/prototype-occasions.ts`. It parses every trigger id used by a support skill or a card-granted P-item into an occasion (from `ProduceTrigger.phaseType`), filters and conditions, using the segment vocabulary recorded in Surprises & Discoveries, and prints any piece it cannot place; its first success criterion is zero unplaced pieces over today's data. It then prints, for every one of today's category counts in every profile, which new profile field carries that number, which proves the restated profiles are a relabelling and surfaces any count that has no home. It also finds where the game keeps the description text of a skill (the wording the player sees, such as 「SPレッスン終了時、所持スキルカードが20枚以上の場合、ボーカル上昇+15」), because breakdown labels for triggers without a filter-table row will be composed from the occasion, filter and condition names, and the prototype must show whether the data can supply those names or a small dictionary of ours is needed. Findings go into this plan before Milestone 1 starts.

Milestone 1 moves the parser into `scripts/lib/parse-trigger.ts` with unit tests for every segment kind and for the three shape rules of decision C4, and changes `build-cards.ts` and `emit.ts` so each generated effect carries `occasion`, `filters` and `conditions` next to the existing `categoryId`, which stays until Milestone 2 removes it. The generator stops failing on redundant or missing filter rows; instead it writes `data/held.generated.ts`, the list of cards hidden because one of their effects contains a piece of unknown kind (C4, C5) or an effect type that is neither a stat nor an audited non-parameter type, each with the reason. Schema errors, unknown enums and a drop in the card count remain hard failures, because they mean the upstream dump is broken rather than that the game grew.

Milestone 2 adds `src/engine/count.ts`, a pure function from a route profile and a parsed effect to occurrences per run, and a new scoring path beside the old one. Profiles are restated in the new shape (see Interfaces) by carrying today's numbers over. A test scores all 204 cards under all four profiles at every 凸 with both engines and requires the 816 rows to be identical (C8); only then are the old path, `categoryId`, `data/taxonomy.extensions.ts` and the taxonomy guards deleted. The golden tests switch to a checked-in snapshot of their nine cards.

Milestone 3 rebuilds `src/app/CustomizePanel.tsx` as the four sections of decision C6, with every filter and condition a number input bounded by its parent, a folded line per section for inputs no visible card reacts to, and a note where a profile ships a condition below the maximum (C7). `src/app/url-state.ts` gets new override keys derived from occasion, filter and condition; old `c.` keys are ignored, which is acceptable because the site has not been deployed.

Milestone 4 prepares the unattended update: the table hides every card listed in `data/held.generated.ts`, and `scripts/check-score-stability.ts` compares the scores of the committed data with the freshly generated data and fails when a card whose own data did not change scores differently — the check that replaces a human reading the weekly diff. The weekly action itself, the conditional pull request and the Discord approval belong to Milestone 5 of the first plan and to the separate approval service (decisions D34 there, C9 here).


## Concrete Steps


Working directory for every command is the repository root, `/Users/ghensk/Developer/gakumas-supportcards`. Work happens on a branch `feature/counting-model` created from an up-to-date `main`.

Milestone 0:

    bun scripts/prototype-occasions.ts

Expected shape of the output, to be replaced by the real transcript when it runs:

    triggers parsed: 81 | occasions: 19 | unplaced pieces: 0
    EndLesson  lesson=sp  produce_card_count>=20        <- s_card_p_skill_filter-…-end_lesson-lesson_sp-produce_card_count-0020_0000
    hif/sashiire  counts[…get_produce_card-…-exam_review-000] = 14  ->  filters.GetProduceCard.effectGroup.members.review
    …
    category counts without a home: 0

Milestones 1 to 4 each end with the same three commands, all of which must succeed:

    bun run generate
    bun test
    bun run type-check

Exact commands and transcripts are added here as each milestone is executed.


## Validation and Acceptance


Milestone 0 is accepted when the prototype reports zero unplaced pieces and zero category counts without a home over the current data, and this plan records where skill description text comes from.

Milestone 1 is accepted when `bun run generate` succeeds on the current data with an empty `data/held.generated.ts`; when, pointed with `GAKUMASU_DIFF_CACHE` at a copy of the tables in which one trigger id has been given an invented threshold piece (`-produce_point-1000_0000`), it still succeeds and the effect carries a new condition; when an invented non-threshold piece in an unknown position instead puts that card, and only that card, into the held list with the piece named as the reason; and when deleting a row from a copy of `SupportCardProduceSkillFilter.yaml` no longer stops generation.

Milestone 2 is accepted when the equivalence test reports 816 identical rows, and when lowering the H.I.F. 差し入れ育成 condition "deck of 20 or more at an SP lesson" from 8 to 3 drops こんにゃくなきもだめし at 凸4 by exactly 15 (the effect is capped at 4 per run, so 8 → 4 changes nothing and 4 → 3 removes one firing) while no card without that condition moves.

Milestone 3 is accepted when, in the page started with `bun run dev`, the panel shows four sections; the SP lesson input cannot exceed the lesson count and the 20枚以上 input cannot exceed the SP lesson input; filtering the table to ロジック leaves only 好印象, やる気 and 元気 unfolded among the effect groups; an override survives a reload through the URL; and the user finds the panel readable, which is the point of the milestone.

Milestone 4 is accepted when a card placed in the held list by the Milestone 1 experiment does not appear in the table, and when `scripts/check-score-stability.ts` passes on the real update of 2026-09-20 replayed from git history and fails when one profile number is changed by hand without any card data changing.

Each new test must be shown to fail when its rule is broken, as the repository's testing doctrine requires.


## Idempotence and Recovery


The generators overwrite their outputs wholesale and the prototype writes nothing, so every step can be rerun. Milestones 1 and 2 are additive until the equivalence test passes: the new fields and the new engine live beside the old ones, so stopping halfway leaves a working site. The deletions at the end of Milestone 2 are one commit that can be reverted. No published number may change at any step; if the equivalence test cannot be made to pass, the discrepancy is recorded in Surprises & Discoveries and brought to the user rather than resolved by adjusting a profile number.


## Artifacts and Notes


The design interview of 2026-09-21 is transcribed into the Decision Log (C0–C9) and Surprises & Discoveries above. The durable decisions are also recorded as `docs/adr/0004-route-profiles-count-occasions-filters-and-conditions.md`, `docs/adr/0005-the-site-never-publishes-a-number-it-cannot-stand-behind.md` and the 2026-09-21 addendum to `docs/adr/0001-score-is-max-performance-parameter-gain-under-all-sp-route.md`.

What still needs a person after this plan, for the record. A tap, with the affected cards hidden meanwhile: a parameter effect under a phase type no profile counts; a filter in a position never seen before; a trigger piece of unknown kind, including an unknown `for_` scenario token; an effect type that is neither a stat nor audited as non-parameter. An investigation, with the site staying on its last good data: a schema change, an unknown enum value, a drop in the card count, a score that moved without its card's data moving. Nothing else.


## Interfaces and Dependencies


No new dependencies. Everything below is a sketch to be corrected by Milestone 0's findings and kept current.

In `scripts/lib/parse-trigger.ts`:

    export interface ParsedTrigger {
      occasion: string;                       // ProduceTrigger.phaseType without its "ProducePhaseType_" prefix, e.g. "EndLesson"
      filters: FilterRef[];                   // e.g. { family: "effectGroup", member: "review" }
      conditions: ConditionRef[];             // e.g. { kind: "produce_card_count", threshold: 20 }
      scenario?: string;                      // from a for_{scenario} piece (C5)
    }
    export type ParseResult = { kind: "parsed"; trigger: ParsedTrigger } | { kind: "unknown-piece"; piece: string };
    export function parseTrigger(triggerId: string, phaseType: string): ParseResult;

In `src/engine/types.ts`, `ClassifiedEffect` gains `occasion`, `filters` and `conditions` and, at the end of Milestone 2, loses `categoryId`; `triggerStat` becomes the lesson-stat filter. `RouteProfile` becomes:

    export interface RouteProfile {
      id: string; name: string;
      occasions: Readonly<Record<string, number>>;                       // occasion -> times per run
      filters: Readonly<Record<string, Readonly<Record<string, FilterFamily>>>>;  // occasion -> family -> counts
      conditions?: Readonly<Record<string, number>>;                     // condition key -> count; absent = maximum (C2, C7)
      lessonSplits: readonly LessonSplit[];
      parameterBonusBase(lessonsOfStat: number): number;
    }
    export interface FilterFamily { default: number; members?: Readonly<Record<string, number>> }  // C3

In `src/engine/count.ts`:

    export function occurrences(effect: ClassifiedEffect, profile: RouteProfile, lessons: LessonSplit): number;

It starts from `profile.occasions[effect.occasion]`, takes the minimum with each filter's count and with each condition's count where the profile or the player states one, then with the lesson split for a lesson-stat filter and with the effect's own `cap`. A trigger restricted to another scenario counts 0.


## Revision notes


- 2026-09-21: Draft created during the design interview with the purpose, the facts gathered from the data, the vocabulary (C0) and the first decision (C1).
- 2026-09-21 (later): Interview completed. Decision Log C2–C9, the effect-group and plan observation, and all remaining sections written. Reason: the judgment calls are settled; what remains before implementation is the user's confirmation.
- 2026-09-21 (confirmation): The user confirmed the design; the draft banner and Progress now say so, and that implementation waits for an explicit go-ahead.
