# Count occasions, filters and conditions instead of one number per filter-table row

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/PLANS.md` at the repository root.

Design confirmed by the user on 2026-09-21. The user gave the go-ahead the same day; Milestone 0 is done and its findings are recorded below (see Progress).


## Purpose / Big Picture


The サポカ凸別点数一覧 (this repository's support card score table for 学園アイドルマスター, described in `docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md`) turns each card effect into points by multiplying its value by how often its trigger happens in one run of a scenario. Today "how often" is one hand-entered number per row of the game's card-filter table, 41 numbers per route profile, shown to the player as a flat grid under 「カウントを調整」. That has three costs the user named on 2026-09-20 and 2026-09-21. First, the weekly data update cannot run unattended: whenever the game adds a filter row, or a card uses a row no profile counts, a person must write numbers into every profile before anything can publish. Second, conditional effects cannot be expressed honestly: the card こんにゃくなきもだめし gains Vocal +15 after an SP lesson only when the deck holds 20 or more skill cards, which is easy on one route and hard on another, yet the model can only treat it as a free-standing count that ignores how many SP lessons there are. Third, the panel is too crowded to read.

After this plan, a route profile states how often each kind of thing happens in a run (an occasion), which share of those occasions a filter selects, and how many of them meet a condition, with every condition defaulting to "always met". The player sees a short nested panel in which a condition sits under its occasion and cannot exceed it. A data update that only adds new filters or conditions on known occasions needs no human input at all.


## Progress


- [x] (2026-09-21) Design interview started (`grill-me`). Facts gathered from the game data before the first question: 81 parameter-bearing triggers reduce to 19 phase types (see Surprises & Discoveries).
- [x] (2026-09-21) Design interview: decisions C0–C9 recorded; ADR 0004 (counting model, supersedes 0002), ADR 0005 (never publish an unscoreable number) and an addendum to ADR 0001 written; `CLAUDE.md` index updated.
- [x] (2026-09-21) The user confirmed that this plan reflects the shared understanding, and asked that implementation not start yet. The next session begins at Milestone 0 only when the user says so.
- [x] (2026-09-21) The user gave the go-ahead. Work happens in the git worktree `.claude/worktrees/counting-model` on branch `feature/counting-model-m0`, created from `feature/counting-model`, which stays checked out in the main checkout.
- [x] (2026-09-21) Milestone 0: `scripts/prototype-occasions.ts` parses all 80 parameter-bearing triggers with 0 unplaced pieces, gives every one of the 41 counts of all four profiles a home, and shows that the wording of a trigger comes from `produceDescriptions[].text`. Findings: Surprises & Discoveries (five new entries), decisions C10–C13 (the user accepted C13, the one number that needed their eye).
- [x] (2026-09-21) Milestone 1, on branch `feature/counting-model-m1`: `scripts/lib/parse-trigger.ts` with tests for every piece kind and the shape rules; every generated effect carries `trigger`; `data/held.generated.ts` (empty on today's data); the generators no longer stop on a missing or redundant filter row. The three acceptance experiments pass (transcript in Concrete Steps). Decisions C14–C15.
- [x] (2026-09-21) Milestone 2, on branch `feature/counting-model-m2`, except the deletions: `src/engine/count.ts`; `score()` counts occasions, filters and conditions when given a `scenarioId`; all four profiles restated beside their `counts`; `data/scenarios/equivalence.test.ts` finds 816 rows × 凸0–4 identical line by line; goldens on `data/scenarios/golden.snapshot.ts` with こんにゃくなきもだめし as the tenth card and the −15 acceptance check. Decisions C16–C17.
- [x] (2026-09-21) Milestone 3, code and tests, on branch `feature/counting-model-m3`: `src/app/panel.ts` (panel model, `applyOverrides`, URL keys `o.` / `f.` / `w.`), `src/app/count-labels.ts`, the rebuilt `CustomizePanel.tsx`, the page scoring by occasions, breakdown lines worded from the trigger; then the deletions of C16 (old counting path, `counts`, `categoryId`, `triggerStat`, taxonomy generator and data, extensions, classifier, equivalence test, prototype; the filter table is no longer loaded). 136 tests pass; the bundle is 56 KB gzipped. Decisions C18–C19.
- [x] (2026-09-22) Milestone 3, acceptance by eye: asked to check the page at the dev server, the user answered "Panel is fine for now", so readability may come back as later feedback rather than as part of this plan. Background: the agent could not drive a browser (the Chrome extension was not connected), so the panel has been verified through its model's tests only — four sections, SP lessons bounded by lessons, 20枚以上 bounded by SP lessons, ロジック leaving 好印象, やる気 and 元気 in view, overrides round-tripping through the URL — and never saw it rendered.
- [x] (2026-09-22) Milestone 4, on branch `feature/counting-model-m4`: the generator also holds a card whose trigger needs a number some shipped profile lacks (`scripts/lib/profile-gate.ts`); the page shows `withoutHeld(CARDS, HELD)`; `bun run generate` writes `data/scores.generated.json` and `scripts/check-score-stability.ts` compares it with the committed one. The acceptance experiments pass (transcript in Concrete Steps). Decision C20. All milestones are done; what remains is the close-out ritual (`close-out` skill) and merging the milestone branches, both the user's call.


## Surprises & Discoveries


- Observation: The game data already says which kind of thing each trigger reacts to. Every row of `ProduceTrigger.yaml` has exactly two fields, `id` and `phaseType`. Across all support card skills and all P-items granted by card events, 81 distinct triggers carry a Vocal, Dance or Visual effect, and they belong to only 19 phase types: `BuyShopItemProduceCard`, `BuyShopItemProduceDrink`, `ChangeProduceCard`, `CustomizeProduceCard`, `DeleteProduceCard`, `EndAudition`, `EndBeforeAuditionRefresh`, `EndLesson`, `EndStepEventActivity`, `EndStepEventSchool`, `GetProduceCard`, `GetProduceDrink`, `GetProduceItem`, `ProduceStart`, `StartCustomize`, `StartPresent`, `StartRefresh`, `StartShop`, and `EndLessonBeforePresent` (the last carries no parameter effect today). `GetProduceCard` alone accounts for 29 of the 81 triggers and `EndLesson` for 15.
  Evidence: a throwaway `bun -e` script over `.cache/gakumasu-diff/` on 2026-09-21 printed `parameter-bearing triggers: 81 | event kinds: 19`.

- Observation: Everything in a trigger id after the phase is one of a small vocabulary of segments. Segments that select which occurrences qualify: `lesson_{vocal,dance,visual}` with optional `_sp` or `_normal`, `lesson_sp`, `p_card_search-{deck_all,mental_skill,active_skill,ssr,…-starter}`, `effect_group-visible-exam_{parameter_buff,lesson_buff,card_play_aggressive,review,concentration,full_power,preservation,block}`. Segments that require a state of the run: `{vocal,dance,visual}-{0400,0700,0900}_0000` (that stat at or above the number), `stamina_ratio-0500_0000` (stamina at half or more), `produce_card_count-0020_0000` (deck of 20 or more), `produce_card_search_count-…-{0008,0015}_0000` (that many matching cards held). One segment restricts the scenario: `for_hajime_legend_ssr` on `get_produce_card-produce_card_count-0017_0000-for_hajime_legend_ssr`.
  Evidence: the same script's grouped listing, 2026-09-21.

- Observation: gakumasu.site, the community tool the user named as the model for a readable panel, groups its calculator inputs by what happens in a run — lessons, actions outside lessons, skill card operations, other — and lists "SP lessons with 20 or more cards" inside the lessons group as its own input.
  Evidence: a machine summary of `https://gakumasu.site/` fetched 2026-09-21; the page is JavaScript-heavy, so details are approximate and must be checked by eye before copying any layout.


- Observation: Effect-group filters never compete within one run. Every support card whose skill carries an `effect_group-visible-exam_*` filter is restricted to one plan, and the group always belongs to that plan: 好調 (`parameter_buff`, 4 cards) and 集中 (`lesson_buff`, 3) only on センス (`Plan1`) cards; 好印象 (`review`, 8), やる気 (`card_play_aggressive`, 1) and 元気 (`block`, 3) only on ロジック (`Plan2`) cards; 全力 (`full_power`, 1) and 温存 (`preservation`, 9) only on アノマリー (`Plan3`) cards; 強気 (`concentration`) appears only on P-items. No common-plan card uses an effect-group filter. So the nine effect-group numbers of a profile are three small independent sets, one per plan, and the panel can show only the set of the plan being looked at.
  Evidence: a throwaway script joining `SupportCardProduceSkillLevel*.yaml`, `ProduceSkill.yaml` and `SupportCard.yaml` on 2026-09-21 printed exactly one plan per effect group.

- Observation (Milestone 0): The trailing `NNNN_NNNN` of a threshold piece is a range, minimum then maximum, where 0000 on either side means unbounded. `p_trigger-start_customize-dance-0000_0900` is worded 「特別指導開始時、ダンスが900以下の場合」 on the P-item 大満足レポート♪, and `stamina_ratio-0500_0000` is 「体力が50%以上」. So the `0000_0000` that follows `get_produce_card`, `delete_produce_card` and `upgrade_produce_card` is an unbounded range, a piece with no meaning, and a condition needs both numbers. The shape rule of C4 is unchanged: a name followed by `NNNN_NNNN` is a condition.
  Evidence: `bun scripts/prototype-occasions.ts --verbose`, 2026-09-21, line `StartCustomize  dance<=900   <- p_trigger-start_customize-dance-0000_0900`.

- Observation (Milestone 0): A 「8枚以上」 trigger is not an acquisition of a card of that effect group; it is any acquisition while 8 or more cards of the group are held. The skill text of `p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_review-000-0008_0000` reads 「スキルカード獲得時、所持している好印象効果のスキルカードが8枚以上の場合、ボーカル上昇+11（プロデュース中4回）」. In the id, everything between `produce_card_search_count` and the closing range describes the cards that are counted (the condition's subject), not the card being acquired. Today's profiles count these four triggers like the unconditional effect-group acquisition (10, 14, 10, 10 in H.I.F.; 6 in 初LEGEND; two of them through `countsAs`), whereas read literally with the condition at the maximum they count every acquisition (20; 12). Every skill that uses one of them is capped at 4 per run, so no score moves: min(4, 14) = min(4, 20). See C11.
  Evidence: the prototype's `DIFF old 14 new 20 cap 4  count differs, capped count equal: no score moves` lines, the same in kind for all four profiles.

- Observation (Milestone 0): One card-granted P-item combines an occasion, a filter and a condition that no profile has a number for. 限界への挑戦券 (`pitem_03-2-134-0`) fires on `p_trigger-upgrade_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000-dance-0700_0000`, 「温存効果のスキルカード強化時、ダンスが700以上の場合」, at most 3 times. Today it is matched by prefix to the plain "skill card upgraded" row and so ignores the 温存 filter altogether: it counts 0 in the three H.I.F. profiles (no upgrades) and 3 in 初LEGEND (every upgrade, a provisional guess of the agent). The new model needs `filters.UpgradeProduceCard.effectGroup`. See C13.
  Evidence: the prototype's `NO NUMBER for filters.UpgradeProduceCard.effectGroup.preservation` lines.

- Observation (Milestone 0): The wording a player sees is in the data, on the skill or the item, not on the trigger. Rows of `ProduceSkill.yaml` and of `ProduceItem.yaml` both carry `produceDescriptions`, a list of fragments whose `text` fields concatenate to the full sentence (「SPレッスン終了時、所持スキルカードが20枚以上の場合、ダンス上昇+8（プロデュース中4回）」; item texts contain newlines). The part before the first 「{ボーカル|ダンス|ビジュアル}上昇+」 is the trigger's wording, and it is the same for every user of a trigger for 79 of the 80 triggers; the exception is an item whose text names another effect first (「…の場合、ランダムなトラブルカードを削除」), which a rule "cut after the last 場合, else after the first 時 or 後" fixes. The two `produce_start` triggers have no clause at all (「初期ダンス上昇+10」). `p_trigger-end_before_audition_refresh` is worded 「試験・オーディション開始時」 in the game, not "after the rest before an audition". So breakdown labels can be taken from the data and no dictionary of ours is needed for triggers. Names for the panel's inputs (occasions, families, members) are a different matter and are still ours to write, about 19 + 6 + 15 short strings, with the filter table's titles as a source where a row exists (ADR 0004).
  Evidence: `trigger wording from produceDescriptions[].text: 79 of 80 triggers give exactly one clause`, 2026-09-21.

- Observation (Milestone 0): The count in this section's first observation moves from 81 triggers to 80, still 19 phase types, and its list of phase types is wrong in one place: `UpgradeProduceCard` is in use (4 triggers) and was left out. The earlier script also walked P-items that no support card grants, which is where `…-for_hajime_legend_ssr` came from; no trigger used by a support card carries a `for_` piece today. Over all 181 rows of `ProduceTrigger.yaml` the prototype parser leaves 17 unparsed, none used by a card: `lesson_hard` and `lesson_{stat}_hard` (8, a new member in the lesson slot, which C4 would count by the family default), `lesson` after `end_lesson_before_present` (4), four bare words after `end_step_event_business` (`produce_card`, `produce_drink`, `produce_point`, `stamina`), and `p_trigger-none-stamina_ratio-0000_0800`, whose phase type is `ProducePhaseType_Unknown`.
  Evidence: the prototype's summary block `all 181 rows of ProduceTrigger.yaml: 17 do not parse, by piece:`.

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

- Decision (C10): A condition is keyed `{occasion}/{kind}[{subject}]{bound}` — `EndLesson/produce_card_count>=20`, `GetProduceCard/produce_card_search_count[effectGroup.review]>=8`, `StartCustomize/dance<=900` — without the trigger's filters. The engine takes the minimum of the occasion's count, each filter's count and each stated condition's count, as the Interfaces sketch already said; nesting 「所持スキルカード20枚以上」 under the SP lesson input is the panel's business (C6), done by bounding the input by the smallest parent among the triggers that use the condition. The lesson-stat filter (`lesson_vocal`) is never a profile number: the lesson split carries it, as `triggerStat` does today. SP and normal are a family of their own, `lessonKind`, with members `sp` and `normal`.
  Rationale: Keying by filter as well would give one 「ダンス700以上」 input per effect group under skill card acquisition, eight inputs where the player has one answer. Found by writing the prototype.
  Date/Author: 2026-09-21 / agent.

- Decision (C11): The four 「8枚以上」 conditions are restated by what the game says — any acquisition, condition at the maximum — and the numbers today's profiles hold for them are dropped, not carried over as lowered condition defaults. C7's "every shipped profile starts with no condition entry" stands.
  Rationale: The old numbers were a reading of the trigger that the skill text contradicts, not a judgment about the route. C8 is about published numbers, and none moves, because every user of these triggers is capped at 4 per run; the 816-row test will prove it rather than this paragraph.
  Date/Author: 2026-09-21 / agent.

- Decision (C12): The parser keeps an explicit list of pieces that mean nothing for counting (`initial` and `no_description` after `produce_start`, `deck_all` and the `1` of `…-ssr-deck_all-1` inside a card search, the unbounded range `0000_0000`, the `visible` and `000` around an effect group). The slot after `p_card_search-` holds members of three families (card type, rarity, name), so a never-seen word there cannot be given a family by position alone; Milestone 1 treats it as a piece of unknown kind (hide and ask, C4's last rule), while a never-seen `exam_*` effect group and a never-seen lesson kind do take their family default.
  Rationale: C4 assumed one family per position; the data has one position with three. Asking is the only honest answer for that slot.
  Date/Author: 2026-09-21 / agent.

- Decision (C13): `filters.UpgradeProduceCard.effectGroup.default` is carried over as the profile's count of upgrades — 0 in the three H.I.F. profiles, 3 in 初LEGEND — so that the P-item 限界への挑戦券 keeps today's score through the migration.
  Rationale: C8, no number moves in the migration. In 初LEGEND it is very likely an overstatement (not all of 3 upgrades hit a 温存 card), but that profile's counts are already marked as the agent's provisional guesses awaiting the user's route sheet, and lowering it afterwards is an ordinary data edit with a visible diff.
  Date/Author: 2026-09-21 / agent, proposed at the end of Milestone 0; accepted by the user the same day.

- Decision (C14): A generated effect carries its parsed trigger as one nested field, `trigger: { occasion, filters?, conditions?, scenario? }`, rather than three sibling fields, and empty lists are omitted. `kind: "event"` effects have no trigger and no `trigger` field. The types (`FilterRef`, `ConditionRef`, `ParsedTrigger`, `HeldCard`) live in `src/engine/types.ts` because the engine will read them; the type of a family name is `FilterFamily`, so the profile-side interface sketched below as `FilterFamily` is renamed `FilterCounts`.
  Rationale: One optional field states "this effect has a trigger" once; three optional fields would allow an occasion without its filters. Omitting empty lists keeps the generated file and the bundle small (the page's script went from about 58 KB to 68 KB gzipped with both `categoryId` and `trigger` present; Milestone 2 removes `categoryId`).
  Date/Author: 2026-09-21 / agent.

- Decision (C15): Between Milestone 1 and Milestone 2 the old engine still scores by `categoryId`, so an (effect type, trigger) pair that no single taxonomy row covers holds its card, exactly like a piece of unknown kind, instead of stopping the run or scoring 0. An extension row the game's table has caught up with is left out with a warning and the game row wins. Both rules disappear with the taxonomy in Milestone 2.
  Rationale: "The generator stops failing on missing filter rows" must not turn into publishing a 0 the site cannot stand behind (`docs/adr/0005`) during the window in which categories still decide the count. If a game row replaces an extension row under a new id, no profile names the new id and `data/scenarios/scenarios.test.ts` fails, which is the right place for that to surface until profiles stop naming categories.
  Date/Author: 2026-09-21 / agent.

- Decision (C16): The deletions this plan put at the end of Milestone 2 — the old counting path, `RouteProfile.counts`, `categoryId`, the taxonomy and its extensions — move to the end of Milestone 3. Until then `score()` takes either model: without `ScoreContext.scenarioId` it counts categories, with it it counts occasions, filters and conditions, and the page keeps calling it without.
  Rationale: The page's 「カウントを調整」 panel and its `c.` URL keys override `counts` by category id. Deleting `counts` before Milestone 3 has built the new panel would leave a page whose overrides do nothing, or no panel at all, and this plan promises that stopping after any milestone leaves a working site. The equivalence test guards the window: while both models exist it proves on every test run that they publish the same numbers.
  Date/Author: 2026-09-21 / agent.

- Decision (C17): `FilterCounts.default` is optional and only the effect-group families state one (H.I.F.: 10 for acquisition; the count of upgrades for upgrades, C13). Card type, rarity, card name and lesson kind name their members and nothing else, so a never-seen member of those families has no number; `missingNumbers` in `src/engine/count.ts` reports it, `data/scenarios/scenarios.test.ts` fails on it, and Milestone 4's gate will hold the card. パラメータボーナス+ is recognised by a generated flag, `bonus: true`, instead of by its category id, and a stat-named effect type that is neither `…Addition` nor `…GrowthRateAddition` now holds its card instead of being read as points per occurrence.
  Rationale: C3's own example gives a default only to the effect groups, where "like the other groups" is the user's standing estimate; there is no such estimate for a third card type or a second rarity, and 0 or the occasion's full count would both be numbers nobody decided. The flag is needed because the new model must not depend on `categoryId`, which is going away.
  Date/Author: 2026-09-21 / agent.

- Decision (C18): In the panel, the occasions of the スケジュール section are read-only, SP lessons are an input bounded by the lessons, and 通常レッスン is not an input: it is shown as what SP lessons leave (lessons − SP lessons), and `applyOverrides` moves it together with an SP-lesson override unless the URL overrides it explicitly. Condition keys, which double as URL keys, use only letters, digits, `.`, `-` and `_` (`EndLesson.produce_card_count.ge20`, `GetProduceCard.produce_card_search_count-effectGroup.review.ge8`, `StartCustomize.dance.le900`), replacing the `/`, `[…]`, `>=` form C10 first wrote down. Override keys in the URL are `o.<Occasion>`, `f.<Occasion>.<family>.<member>` and `w.<condition key>`; a key the chosen profile does not let the player adjust is dropped on parse, as are the `c.` keys of the former model.
  Rationale: A lesson is either SP or normal, so lowering SP lessons to 5 of 8 while 通常レッスン stayed at the profile's 0 would make three lessons vanish and understate every 通常レッスン card; two free inputs would let the player state 8 + 8 lessons out of 8. The first key form needed percent-escaping for five of its characters, which made shared URLs unreadable.
  Date/Author: 2026-09-21 / agent.

- Decision (C19): Breakdown lines and panel inputs are worded from the parsed trigger by a small dictionary of ours, `src/app/count-labels.ts` — 「スキルカード獲得時（好印象）／ダンス700以上」, 「所持スキルカード20枚以上」 — with the game's own word as the fallback for anything the dictionary does not know. The engine's `BreakdownLine` carries the trigger instead of a title, and the generator does not read `produceDescriptions` or the filter table.
  Rationale: Milestone 0 showed that the trigger's wording can be cut out of a skill's text, but a P-item with two skills has one text for both, the cut needs a rule per sentence shape, and the panel needs names for occasions, families and members regardless, which no game text supplies on its own. One dictionary serves both, keeps the generated data free of repeated sentences (the bundle went from 70 KB to 56 KB gzipped once `categoryId` left and no label arrived), and degrades visibly rather than wrongly. A test over the shipped data fails when any panel input still shows a raw game word.
  Date/Author: 2026-09-21 / agent.

- Decision (C20): The score-stability check compares snapshots of published scores, not two sets of card data. `bun run generate` writes `data/scores.generated.json` — per card that is not held, a hash of its generated record and its 点数 at 凸0–4 under every shipped route profile — and `scripts/check-score-stability.ts` recomputes the scores from the working tree and compares them with the snapshot committed at a git ref (default `HEAD`) or given as a file: a card whose hash is unchanged must have unchanged scores; new, removed and newly held cards are free. It also fails when the working tree's own snapshot is stale. Separately, the generator holds a card when any shipped profile lacks a number one of its triggers needs (a phase type no profile counts, a never-seen member of a family without a default), so the hidden-card list has one home, `data/held.generated.ts`, for both kinds of reason.
  Rationale: Scoring old and new card data with the same engine and profiles can never disagree for an unchanged card, so that comparison would be vacuous; what has to be pinned is what was published, and only a committed snapshot records it without checking out and running old code. The known blind spot: a parser change that reads an unchanged trigger id differently changes the card's generated record, so its hash, and is let through; the parser's unit tests and the golden scores cover that side. The check is meant for the unattended update; a deliberate profile or engine change fails it by design and is resolved by reviewing the listed moves and committing the regenerated snapshot.
  Date/Author: 2026-09-22 / agent.


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

Milestone 2 adds `src/engine/count.ts`, a pure function from a route profile and a parsed effect to occurrences per run, and a new scoring path beside the old one. Profiles are restated in the new shape (see Interfaces) by carrying today's numbers over. A test scores all 204 cards under all four profiles at every 凸 with both engines and requires the 816 rows to be identical (C8); only then are the old path, `categoryId`, `data/taxonomy.extensions.ts` and the taxonomy guards deleted — at the end of Milestone 3 rather than here, because the page's override panel reads the old counts until Milestone 3 replaces it (decision C16). The golden tests switch to a checked-in snapshot of their cards.

Milestone 3 rebuilds `src/app/CustomizePanel.tsx` as the four sections of decision C6, with every filter and condition a number input bounded by its parent, a folded line per section for inputs no visible card reacts to, and a note where a profile ships a condition below the maximum (C7). `src/app/url-state.ts` gets new override keys derived from occasion, filter and condition; old `c.` keys are ignored, which is acceptable because the site has not been deployed.

Milestone 4 prepares the unattended update: the table hides every card listed in `data/held.generated.ts`, and `scripts/check-score-stability.ts` compares the scores of the committed data with the freshly generated data and fails when a card whose own data did not change scores differently — the check that replaces a human reading the weekly diff. The weekly action itself, the conditional pull request and the Discord approval belong to Milestone 5 of the first plan and to the separate approval service (decisions D34 there, C9 here).


## Concrete Steps


Working directory for every command is the repository root, `/Users/ghensk/Developer/gakumas-supportcards`. Work happens on a branch `feature/counting-model` created from an up-to-date `main`.

Milestone 0:

    bun scripts/prototype-occasions.ts

The game tables must be in `.cache/gakumasu-diff/`; in a fresh worktree, copy that directory from the main checkout or let the script fetch the tables. Transcript of 2026-09-21, shortened:

    triggers parsed: 80 | occasions: 19 | unplaced pieces: 0

    all 181 rows of ProduceTrigger.yaml: 17 do not parse, by piece:
      lesson_hard  x5  e.g. p_trigger-end_lesson-lesson_hard
      …
    == hif/sashiire: 41 counts -> 19 occasions, 18 filter members, 2 stated conditions; without a home: 0
      counts[…get_produce_card-produce_card_search_count-…-exam_full_power-000-0008_0000] = 10  ->  conditions["GetProduceCard/produce_card_search_count[effectGroup.full_power]>=8"] = 10   ** parent is 20: C7 says profiles ship no such entry **
      filters.EndLesson.lessonKind: normal 0, sp 8
      filters.GetProduceCard.cardType: mental 13, active 7
      filters.GetProduceCard.effectGroup: parameter_buff 10, lesson_buff 10, card_play_aggressive 10, review 14, concentration 10, full_power 10, preservation 10, block 12
      filters.GetProduceCard.rarity: ssr 10
      …
      DIFF old 14 new 20 cap 4  count differs, capped count equal: no score moves  <- p_trigger-get_produce_card-produce_card_search_count-…-exam_review-000-0008_0000
      DIFF old 0 new 0 cap 3  NO NUMBER for filters.UpgradeProduceCard.effectGroup.preservation  <- p_trigger-upgrade_produce_card-…-exam_preservation-000-dance-0700_0000 [item pitem_03-2-134-0 限界への挑戦券]
    …
    category counts without a home: 0

    trigger wording from produceDescriptions[].text: 79 of 80 triggers give exactly one clause

`bun scripts/prototype-occasions.ts --verbose` adds one line per parsed trigger, per restated count and per trigger wording:

    EndLesson  lessonKind=sp  produce_card_count>=20   <- p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000
    counts[…get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000] = 14  ->  filters.GetProduceCard.effectGroup.members.review
    SPレッスン終了時、所持スキルカードが20枚以上の場合   <- p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000

The "2 stated conditions" and their `**` lines are the 「8枚以上」 numbers that decision C11 drops; the `DIFF … no score moves` lines are the same finding seen from the cards' side, and the `NO NUMBER` line is what decision C13 answers.

Milestone 1 acceptance, run on 2026-09-21 with a temporary script (deleted afterwards) that copied `.cache/gakumasu-diff/` three times, edited each copy, and ran `bun run generate` with `GAKUMASU_DIFF_CACHE` pointing at it. The edited trigger is `p_trigger-start_shop-visual-0400_0000`, used only by the P-item 居眠り注意！ that the card ゆるるんあくび顔 grants; the edit renames it in every table. Shortened transcript:

    == (a) invented threshold piece -produce_point-1000_0000: exit 0
      Wrote data/held.generated.ts: 0 held cards
      居眠り注意！ effect trigger: "trigger":{"occasion":"StartShop","conditions":[{"kind":"visual","min":400,"max":0},{"kind":"produce_point","min":1000,"max":0}]}
    == (b) invented piece of unknown kind -mystery: exit 0
      Wrote data/held.generated.ts: 1 held cards
        HELD s_card-2-0076 ゆるるんあくび顔 — item pitem_03-2-130-0 居眠り注意！: trigger p_trigger-start_shop-visual-0400_0000-mystery has a piece of unknown kind: mystery
    == (c) filter row for 休む選択時 deleted: exit 0
      Wrote data/held.generated.ts: 9 held cards
        HELD s_card-1-0000 念入りにストレッチ — … no single taxonomy row covers ProduceEffectType_VisualAddition @ p_trigger-start_refresh …
    == restore: real tables: exit 0
      Wrote data/held.generated.ts: 0 held cards

In (c) the nine held cards are exactly the nine that have a 休む選択時 skill (decision C15). The new tests were shown to fail by breaking their rules: making an unknown `for_` token parse, and making `hold()` forget its reasons, turned 6 tests red.

Milestone 4 acceptance, run on 2026-09-22 with a temporary script (deleted afterwards). The replay downloads the 13 tables of `vertesan/gakumasu-diff` at commit `db320b2` (2026-09-15, the data this repository's generation of 2026-09-17 used) into a scratch directory, generates from them, keeps that `data/scores.generated.json` as the base, generates from today's tables (upstream `75eb2a9`, 2026-09-20) and runs the check with `--base-file`. Shortened transcript:

    == replay: generate from upstream 2026-09-15 tables: exit 0
      Wrote data/cards.generated.ts: 202 cards (199 with parameter effects, previously 204)
    == replay: generate from today's tables: exit 0
      Wrote data/cards.generated.ts: 204 cards (201 with parameter effects, previously 202)
    == replay: check against the snapshot from before the update: exit 0
      Compared with …/scores.before.json: 204 cards now, 2 new, 0 gone or held, 0 with changed data, 0 unexplained score moves.
    == hand-edited profile (差し入れ育成 StartPresent 5 -> 4), not regenerated: exit 1
      Compared with …/scores.today.json: 204 cards now, 0 new, 0 gone or held, 0 with changed data, 31 unexplained score moves.
      data/scores.generated.json is not what the working tree scores to; run `bun run generate`.
        MOVED s_card-1-0006 ひたむき居残りレッスン [hif/sashiire]: [53,61,83,88.5,93] -> [49,57,75,80.5,85] with unchanged card data
        …
    == held: generate with an invented piece of unknown kind: exit 0
        HELD s_card-2-0076 ゆるるんあくび顔 — item pitem_03-2-130-0 居眠り注意！: trigger p_trigger-start_shop-visual-0400_0000-mystery has a piece of unknown kind: mystery
      Wrote data/scores.generated.json: 203 cards × 4 route profiles
    == held: what the table would show: exit 0
      held list: ゆるるんあくび顔 | table shows 203 of 204 cards; ゆるるんあくび顔 shown: false
    == held: check against today's snapshot (a newly held card is free to leave): exit 0
      Compared with …/scores.today.json: 203 cards now, 0 new, 1 gone or held, 0 with changed data, 0 unexplained score moves.

The replay is of the data, not of the code of 2026-09-20: both sides are generated and scored by today's generator and engine, which is what the weekly action will do. The new tests were shown to fail by removing the data-hash rule from `unexplainedMoves` (one test red).

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


No new dependencies. The first two blocks below are as built in Milestone 1; the rest is a sketch to be corrected as Milestone 2 meets it.

In `src/engine/types.ts` (as built):

    export type FilterFamily = "lessonStat" | "lessonKind" | "cardType" | "rarity" | "cardName" | "effectGroup";
    export interface FilterRef { family: FilterFamily; member: string }          // e.g. { family: "effectGroup", member: "review" }
    export interface ConditionRef {
      kind: string;                           // the game's word: "vocal", "stamina_ratio", "produce_card_count", "produce_card_search_count", …
      subject?: FilterRef[];                  // produce_card_search_count only: which held cards are counted; absent = all (C11)
      min: number; max: number;               // inclusive, as written in the id; 0 = unbounded on that side
    }
    export interface ParsedTrigger {
      occasion: string;                       // ProduceTrigger.phaseType without its "ProducePhaseType_" prefix, e.g. "EndLesson"
      filters?: FilterRef[];                  // omitted when empty (C14)
      conditions?: ConditionRef[];
      scenario?: string;                      // from a for_{token} piece (C5): our scenario id, or the token of a scenario we do not ship
    }
    export interface HeldCard { id: string; name: string; reasons: string[] }    // data/held.generated.ts exports HELD: readonly HeldCard[]

`ClassifiedEffect` has gained `trigger?: ParsedTrigger` (absent for `kind: "event"`) and, at the end of Milestone 2, loses `categoryId`; `triggerStat` becomes the lesson-stat filter.

In `scripts/lib/parse-trigger.ts` (as built):

    export type ParseResult = { kind: "parsed"; trigger: ParsedTrigger } | { kind: "unknown-piece"; piece: string };
    export const SCENARIO_TOKENS: Readonly<Record<string, string>>;              // hif, hif_memory -> "hif"; hajime_legend, hajime_legend_ssr -> "hajime-legend"; nia_master -> "nia_master"
    export function parseTrigger(triggerId: string, phaseType: string, scenarioTokens?: Readonly<Record<string, string>>): ParseResult;

`buildCards` in `scripts/lib/build-cards.ts` returns `report.held: HeldCard[]` in place of the former `report.unclassified`.

`RouteProfile` becomes (sketch):

    export interface RouteProfile {
      id: string; name: string;
      occasions: Readonly<Record<string, number>>;                       // occasion -> times per run
      filters: Readonly<Record<string, Readonly<Partial<Record<FilterFamily, FilterCounts>>>>>;  // occasion -> family -> counts; never lessonStat (C10)
      conditions?: Readonly<Record<string, number>>;                     // condition key (C10) -> count; absent = maximum (C2, C7)
      lessonSplits: readonly LessonSplit[];
      parameterBonusBase(lessonsOfStat: number): number;
    }
    export interface FilterCounts { default?: number; members?: Readonly<Record<string, number>> }  // C3, C17; as built

As built in Milestone 2, `RouteProfile` has these fields next to the old `counts`, which leaves at the end of Milestone 3 (C16).

In `src/engine/count.ts`:

    export function occurrences(effect: ClassifiedEffect, profile: RouteProfile, lessons: LessonSplit): number;

It starts from `profile.occasions[effect.occasion]`, takes the minimum with each filter's count and with each condition's count where the profile or the player states one, then with the lesson split for a lesson-stat filter and with the effect's own `cap`. A trigger restricted to another scenario counts 0.


## Revision notes


- 2026-09-21: Draft created during the design interview with the purpose, the facts gathered from the data, the vocabulary (C0) and the first decision (C1).
- 2026-09-21 (later): Interview completed. Decision Log C2–C9, the effect-group and plan observation, and all remaining sections written. Reason: the judgment calls are settled; what remains before implementation is the user's confirmation.
- 2026-09-21 (confirmation): The user confirmed the design; the draft banner and Progress now say so, and that implementation waits for an explicit go-ahead.
- 2026-09-21 (Milestone 0): Go-ahead received, prototype written and run. Progress, five observations, decisions C10–C13, the real transcript and the corrected `ParsedTrigger` sketch added. Reason: Milestone 0 exists to correct the plan before Milestone 1 builds on it.
- 2026-09-21 (Milestone 1): Progress, decisions C14–C15, the acceptance transcript and the Interfaces section brought in line with the code (`trigger` nested, types in `src/engine/types.ts`, `FilterCounts`). Reason: the sketch was written before the parser existed.
- 2026-09-21 (Milestone 2): Progress, decisions C16–C17; the deletions moved from Milestone 2 to the end of Milestone 3 in Progress. Reason: the page's override panel still depends on the old counts, found when starting Milestone 2.
- 2026-09-21 (Milestone 3): Progress split into "code and tests" (done) and "acceptance by eye" (open, the agent had no browser); decisions C18–C19. Reason: the milestone's last criterion is the user's judgment of readability, which no test can stand in for.
- 2026-09-22 (Milestone 4): Progress, decision C20, the acceptance transcript; Plan of Work and Validation left as written, with C20 recording how the check differs from their wording ("compares the scores of the committed data with the freshly generated data"). Reason: a comparison of card data alone turned out to be vacuous.
