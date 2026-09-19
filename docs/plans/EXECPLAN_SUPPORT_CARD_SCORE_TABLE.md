# Build the サポカ凸別点数一覧: a scenario-driven support card score table

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/PLANS.md` at the repository root.


## Purpose / Big Picture


A player of 学園アイドルマスター (Gakuen Idolmaster, "gakumas") choosing which support cards to bring into a produce run, or deciding which card is worth spending limit-break resources on, wants one glance at "how many parameter points does this card give me at each limit-break level in the scenario I am playing". Today that question is answered by hand-made spreadsheets, a YouTube video, and a third-party search tool with a manual calculator. After this plan, opening `https://gakumas-supportcards.tia.run` shows a table: one row per support card with its thumbnail (the card name appears on hover), five columns of 点数 for 凸0 to 凸4, filters for card type (Vo/Da/Vi/Assist), plan (センス/ロジック/アノマリー/共通) and rarity, sortable by any 凸 column, with a scenario switcher whose default is H.I.F. and whose second entry is 初LEGEND. The numbers are recomputed from the game's data dump every week without anyone typing card values, and the thumbnails come from an image library we own.

The user can see it working by opening the page, choosing H.I.F., sorting by 凸4, and seeing SSR cards with SP-lesson effects at the top; hovering a thumbnail shows the card name; hovering a number shows its breakdown (skills, events, P-item); switching to 初LEGEND changes every number; the folded 「カウントを調整」 panel lets them change how many SP lessons the route assumes and watch the numbers follow.


## Progress


- [x] (2026-09-16) Design settled in a grill-me session; twelve decisions recorded in the Decision Log below. Repository scaffolded from `Taka499/project-template@b52b8df`.
- [x] (2026-09-16) Three ADRs written: `docs/adr/0001` (score definition), `docs/adr/0002` (taxonomy), `docs/adr/0003` (image library).
- [x] (2026-09-16) Milestone 0, build part: `scripts/prototype-join.ts` joins 14 tables, classifies every skill effect of all 202 cards and every parameter effect of the 132 card-granted P-items with zero unclassified pairs (six extension rows needed, see Decision Log D13), discovers the event and P-item join paths, and prints `s_card-3-0016` and `s_card-3-0073` at 凸0–凸4. Branch `feature/m0-prototype-join`.
- [x] (2026-09-17) Milestone 0, acceptance part: the user confirmed in game that 1人たりとも欠ける事なく at level 60 shows 初期ボーカル+65, 相談選択時ボーカル+14, イベントパラメータ上昇+100%, and that ｖギャルピーーースッｖ at level 60 shows スキルカード削除時ボーカル+11, 初期ボーカル+65, 活動支給・差し入れ選択時ボーカル+17, イベントパラメータ上昇+100%; and accepted decisions D13–D17 as proposed. Milestone 0 is complete.
- [x] (2026-09-17) Milestone 1: `scripts/generate-taxonomy.ts` and `scripts/generate-cards.ts` over a shared `scripts/lib/` (tables loader, classifier, card builder, emitters) write `data/taxonomy.generated.ts` (46 game rows + 6 extension rows), `data/cards.generated.ts` (202 cards, 199 with parameter effects) and `data/levelLimits.generated.ts`; `data/taxonomy.extensions.ts` holds the six hand-written rows (D13). 24 unit tests pass; second run is byte-identical; deleting the 相談選択時 row from a copy of the taxonomy makes the generator exit 1 naming five orphaned pairs; dropping one card trips the count guard. Prototype script retired. Branch `feature/m1-generators` (stacked on M0, not yet merged).
- [ ] Milestone 2 (partially completed 2026-09-17, branch `feature/m2-engine` stacked on M1): completed — `src/engine/score.ts` (`levelFor`, `resolveAtLevel`, `routeCount`, `score`, `scoreAtLevel`, breakdown lines) with 12 unit tests; `RouteProfile`/`Scenario`/`Score` types; `data/scenarios/hajime-legend.ts` with a provisional 標準 profile derived from the plan's week table (guesses marked in the file); `data/scenarios/scenarios.test.ts` checks every profile's category ids against the taxonomy and scores all 202 cards at every 凸 (42 tests pass in total); spot check under that profile: 1人たりとも欠ける事なく 凸4 = 161 (65 初期 + 14×4 相談 + 20×2.0 event), ｖギャルピーーースッｖ 凸4 = 206. (2026-09-19) H.I.F. researched from both wikis, `route-profiles.html` rebuilt as a derivation sheet (choice days per profile, play-style parameters, derived counts with overrides, four questions), answered by the user; `data/scenarios/hif.ts` written from the answer with three profiles (D21–D24), H.I.F. made the default, `parameterBonusBase` rename, 初LEGEND corrected to five lessons / four 授業 / two auditions (D18–D20; other counts still guesses). 48 tests pass. Spot check, 差し入れ育成 凸4: 1人たりとも欠ける事なく 147, ｖギャルピーーースッｖ 278. (2026-09-19, later) User's revised answer applied (相談 削除 2/2/5, 元気効果 12, third profile 汎用コンテ育成); lesson-end triggers found to be stat-bound → `triggerStat` on effects, six lesson-split presets per profile, `parameterBonusBase(n)` as a function, `scoreBest` picking the best preset per card (D25, D26); card data regenerated; 56 tests pass. Spot check, 差し入れ育成 best preset 凸4: 1人たりとも欠ける事なく 147, ｖギャルピーーースッｖ 256, 大切な思い出、またひとつ 462.5 (Vo7/Da1/Vi0). Golden tests pinned in `data/scenarios/golden.test.ts` for nine cards chosen to cover every mechanism (breakdowns in § Artifacts); the values are engine-derived and the user verifies the breakdowns rather than supplying numbers (the user does not track community values). Remaining — the user's verification of those breakdowns, and a 初LEGEND route sheet to replace the guesses (including its presets).
- [ ] Milestone 3: table UI with thumbnails, filters, sort, breakdown, scenario switcher, folded customize panel. Hand-off note (2026-09-19, session ended before M3 started): work sits on `feature/m2-engine` (commits bb1b3e8, fafdfb5, f7d2b31 stacked M0→M1→M2, none merged to `main` yet — merge or open PRs in order, or branch `feature/m3-ui` from `feature/m2-engine`). Nothing from M3 exists: Vite/Preact/Tailwind are not installed (the sibling `gakumas-hajime-lesson` uses `@preact/preset-vite` + `@tailwindcss/vite` with `src/index.css` = `@import "tailwindcss";` and `src/main.tsx` rendering into `#app`). The UI must use `scoreBest` by default with a control to fix one of the profile's `lessonSplits` (D26), show `Score.lines` in the number tooltip and `Score.lessons` in it, key URL count overrides by category id minus the common prefix, and list 0-point cards last with 「パラメータ効果なし」 (D10). Still open from M2: the user's verification of the nine golden breakdowns (§ Artifacts) and a 初LEGEND route sheet (its presets and non-schedule counts are guesses). Untracked scratch pages at the repository root (`taxonomy-gap-explained.html`, `decisions-d13-d17.html`, `route-profiles.html`) are not to be committed; delete when no longer needed. No ESLint yet — the global Quality Gates want lint rules as errors; set it up with the UI (M3) or CI (M5).
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

- Observation: The game's filter table (46 rows) does not cover every trigger that support cards and card-granted P-items actually use. Five card triggers have no row: three 「スキルカード獲得時、所持している{好印象,温存,集中}効果のスキルカードが8枚以上の場合」 variants (`p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_{review,preservation,lesson_buff}-000-0008_0000`, cards `s_card-3-0103/0104/0106/0107`) and 「相談でスキルカード交換後」 (`p_trigger-buy_shop_item_produce_card`, card `s_card-3-0108`). Two P-item trigger families have no row either: `p_trigger-end_before_audition_refresh-{vocal,dance,visual}-0400_0000` (試験・オーディション前の休憩後) and `p_trigger-end_lesson-lesson_sp-*` (any-stat SP lesson end, which the game table lists only under the stamina-recovery row).
  Evidence: first prototype run on 2026-09-16 printed eight distinct unmatched (effect type, trigger) pairs with `candidates=0`; after adding six extension rows (D13) the run prints `Unclassified (effectType, trigger) pairs: 0`.

- Observation: P-item and some card triggers carry condition suffixes on top of a taxonomy trigger id, e.g. `p_trigger-start_shop-vocal-0400_0000` (相談選択時, if Vo ≥ 400), `p_trigger-end_lesson-lesson_vocal-stamina_ratio-0500_0000`, `p_trigger-get_produce_card-…-exam_full_power-000-visual-0400_0000`. Matching the longest taxonomy trigger id that is a `-`-delimited prefix resolves all of them; 32 pairs classified this way, 32 658 exactly.
  Evidence: prototype `Match statistics: exact 32658, prefix 32, via extension rows 268` (counts are per card-level pass, so inflated, but the zero remainder is what matters).

- Observation: `ProduceSkill.activationCount` is a per-run cap on how often a support skill fires: 0 means unlimited, otherwise the skill text says 「（プロデュース中N回）」. Over classified parameter effects the values are 0, 1, 2, 3, 4, 5, 6 and 10 (e.g. Pドリンク獲得時 skills cap at 10, 試験・オーディション終了時 and 活動支給・差し入れ選択時 at 2, スキルカードチェンジ時 at 3). The score must therefore use min(cap, route count), not route count alone.
  Evidence: prototype `activationCount distribution … 0:17626 1:10790 2:1426 3:762 4:1042 5:102 6:860 10:41`; skill description text 「…ボーカル上昇+11（プロデュース中4回）」.

- Observation: 198 of 202 cards carry a produce-start skill of type `ProduceEffectType_SupportCardEventParameterAdditionValueUp` whose description reads 「このサポートカードのイベントによるパラメータ上昇を50%増加」, value in permil (500/750/1000 across skill levels). It multiplies the card's own event parameter rewards, so D12's event part must apply it. Sibling types for P-points and stamina score 0.
  Evidence: `ProduceSkill.yaml` row `p_support_skill-common-p_trigger-produce_start-no_description-support_card_event_parameter_addition_value_up-01-001`; `ProduceEffect.yaml` values 500, 750, 1000.

- Observation: SSR cards have three events, unlocking at card level 1, 20 and 40 (110 cards have a third event, all `s_card-3-*`); R and SR cards have two (1 and 20). The plan's "events unlock at level 1 and level 20" was incomplete.
  Evidence: `ProduceEventSupportCard.yaml` (number, supportCardLevel) pairs: 202×(1,1), 202×(2,20), 110×(3,40).

- Observation: `ProduceItem.fireLimit` 0 means unlimited, not zero: 打倒！墾田永年私財法 (`pitem_00-2-002-0`, fireLimit 0) gives Vo+26 before every audition once Vo ≥ 400. So D11's "value × trigger limit" only works for items with fireLimit ≥ 1; unlimited items need the route count of their trigger's category, which means item effects must be classified like skill effects. 41 of the 132 items granted by card events have parameter effects; the other 91 (including みんなの教科書 and しぼまない思い出 of the two sample cards) only carry exam-time enchants and score 0.
  Evidence: prototype item report; join path `ProduceItem.skills[].produceItemEffectId → ProduceItemEffect.produceEffectId → ProduceEffect` with the trigger in `ProduceItem.skills[].produceTriggerId`.

- Observation: Every effect referenced by support skills, events and items has `effectValueMin == effectValueMax`, and every support skill has `activationRatePermil` 0 — there are no ranges and no probabilistic skills to model.
  Evidence: prototype `Effects with min != max: 0`, `Skills with activationRatePermil != 0: 0`.

- Observation: The redundancy guard for extension rows (D13) must not treat a game row that lists a *longer* trigger id as coverage: the game row 「SPレッスン終了時所持スキルカードが20枚以上の場合」 lists `p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000`, which extends the extension trigger `p_trigger-end_lesson-lesson_sp` but is a different, conditional category and would never win classification for the plain trigger. The guard therefore fires only when a game row lists the extension's trigger id verbatim or as a `-`-delimited prefix of it — exactly the cases where the game row would win.
  Evidence: first `bun run generate` on 2026-09-17 exited 1 with "ext-vocaladdition-p_trigger-end_lesson-lesson_sp … is covered by s_card_p_skill_filter-vocaladdition-p_trigger-end_lesson-lesson_sp-produce_card_count-0020_0000" under the eager rule; `scripts/lib/classify.test.ts` pins the corrected rule.

- Observation: Every card has 13–17 breakpoint levels because skills upgrade every few levels, so `data/cards.generated.ts` is 1.7 MB of source; gzipped it is 39 KB.
  Evidence: `awk` count of `"minLevel"` per card line and `gzip -9 | wc -c` on 2026-09-17.

- Observation: The plan's Context description of 初LEGEND was wrong on lessons: 初LEGEND has only the five レジェンドレッスン (weeks 4, 7, 12, 14, 16); the "+100, +100, +150, +200 regular lessons at weeks 1, 2, 6, 15" are 授業 (classes: 選択パラ+100/+100/+150/+200 plus a card acquisition or チェンジ), which fire 「授業・営業終了時」, not lesson triggers. レジェンドレッスン is simply the scenario's name for its lessons; they can be SP like any lesson.
  Evidence: user statement 2026-09-17; wikiwiki 初LEGEND page (2026-03-26) schedule table and 授業 section. The provisional `data/scenarios/hajime-legend.ts` written earlier on 2026-09-17 counted 9 lessons and must be corrected.

- Observation: H.I.F. structure from wikiwiki `HIF/基本情報` (2026-09-13) and 学マスwiki `H.I.F`: 選抜試験 20 days — 公開レッスン on days 2, 4, 9, 11, 15, 18 (SP gains to the selected stat 60/80/80/100/100/120, sub-stat 20/50/20/60/20/70), 授業 on 3, 6 (param 120, acquire a card) and 10, 17 (150, セレクトチェンジ), 選抜試験 on 7, 13, 20 (parameter rewards base 20/80/100 per stat plus 80/200/220 distributed by score share; パラメータボーナス applies), choice days 1 {相談/差し入れ/特別指導}, 5 {おでかけ/相談}, 8 {おでかけ/差し入れ}, 12 {相談/特別指導}, 14 {おでかけ/差し入れ}, 16 {おでかけ/相談/差し入れ}, 19 {相談/特別指導}. 本戦 — 授業 days 1, 4 (180, チェンジ), 公開レッスン 2, 5 (SP 120/140), day 3 {おでかけ/差し入れ}, 相談 day 6, then ラウンド1 (9 turns), インターバル (shop-like; 相談/特別指導 triggers do not fire, カスタマイズ時 does), ラウンド2 (12 turns). 差し入れ = P80 + 1 drink (SR+) + 1 card; おでかけ = −50P, 60% HP, 1 drink, 1 upgraded card, 1 card, 1 trouble; 相談 unchanged; 特別指導 = 2 customisations; public lessons give no cards. All-SP lesson total to the selected stat = 800 (wiki's own figure). Cap 3000 (3000–3200 with H.I.F. bonus per 学マスwiki). 授業 gains are not multiplied by パラメータボーナス; lesson and 選抜試験 gains are.
  Evidence: raw page text fetched 2026-09-17 (`curl` + tag stripping), tables quoted verbatim in `route-profiles.html`.

- Observation: `Produce.yaml` carries the parameter cap as `idolCardParameterGrowthLimit`: `produce-006` レジェンド 3000, `produce-007` 選抜試験 3000, `produce-008` 本戦 3000 (レギュラー 1000, プロ 1500, マスター 1800, N.I.A. プロ 2000, マスター 2600). The plan's 初LEGEND cap of 2800 (from the sibling project) disagrees with the current dump; the H.I.F. cap 3000 is confirmed.
  Evidence: awk over `Produce.yaml` on 2026-09-16.


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

- Decision (D13): The taxonomy is the game's filter table plus a small hand-maintained extension list (`data/taxonomy.extensions.ts` from Milestone 1; `EXTENSION_ROWS` in the prototype) for triggers the game table does not cover. Each extension row has the same shape as a game row (id prefixed `ext-`, a title in the game's own skill/item wording, effect types, trigger ids), an optional `countsAs` pointing at the game row whose route count it shares (the conditional 8枚以上 variants count as their unconditional 獲得時 category; `lesson_sp` counts as SPレッスン終了時), and a source comment naming the cards or items that need it. The generator fails when an effect matches no row and also when an extension row's trigger becomes covered by a game row, so extensions are retired as soon as the game catches up. Six rows exist today (three 8枚以上 variants, 相談でスキルカード交換後, 試験・オーディション前の休憩後, SPレッスン終了時 for `lesson_sp`).
  Rationale: The game table lags the newest cards (five cards would otherwise be unclassifiable) and never covered P-item triggers. Dropping those cards contradicts D10; silently mapping them to a phase contradicts ADR 0002's "fails loudly". An explicit, audited supplement keeps both. Rejected alternative: exclude the five cards and the affected items and show them as 「未分類」. ADR 0002 carries an addendum dated 2026-09-17 recording this.
  Date/Author: 2026-09-16 / proposed by the agent from Milestone 0 evidence; accepted by the user 2026-09-17.

- Decision (D14): A trigger id that is not listed verbatim in any taxonomy row classifies to the row (with a matching effect type) whose listed trigger id is the longest `-`-delimited prefix of it; ties across rows fail the build. Under D10 the extra condition segments (`-vocal-0400_0000`, `-stamina_ratio-0500_0000`) are assumed satisfied, so the category's route count applies unchanged.
  Rationale: Every P-item parameter trigger and the newest card triggers are "category + condition"; the prefix is exactly the category. Rejected: mapping by `phaseType` (loses the per-category granularity the taxonomy provides, e.g. 好印象 vs 温存 card acquisition).
  Date/Author: 2026-09-16 / proposed by the agent from Milestone 0 evidence; accepted by the user 2026-09-17.

- Decision (D15): A skill effect's per-run occurrences are min(`activationCount`, route count of its category), where `activationCount` 0 means no cap. Amends the formula in Interfaces and Dependencies.
  Rationale: The game caps most non-lesson triggers (「プロデュース中N回」); ignoring the cap overstates e.g. Pドリンク獲得時 cards.
  Date/Author: 2026-09-16 / proposed by the agent from Milestone 0 evidence; accepted by the user 2026-09-17.

- Decision (D16): A card-granted P-item's parameter effects are classified with the same taxonomy and prefix rule as skills, and count min(`fireLimit`, route count of the category) times, where `fireLimit` 0 means no cap. This replaces D11's "value × trigger limit" for the unlimited case and equals it otherwise. The item part stays a separate breakdown entry.
  Rationale: 11 of the 41 parameter-bearing items have `fireLimit` 0 and fire on every occurrence of their trigger; a fixed multiplier cannot express that.
  Date/Author: 2026-09-16 / proposed by the agent from Milestone 0 evidence; accepted by the user 2026-09-17.

- Decision (D17): The event part is the sum over events unlocked at the card's level (SSR: levels 1, 20, 40; R/SR: 1, 20) of parameter rewards × (1 + `eventBonusPermil` / 1000), where `eventBonusPermil` is the card's `SupportCardEventParameterAdditionValueUp` value at that level (0 when absent). Amends D12.
  Rationale: 198 of 202 cards carry the bonus and it reaches +100% at 凸4, so omitting it halves the event part of nearly every card.
  Date/Author: 2026-09-16 / proposed by the agent from Milestone 0 evidence; accepted by the user 2026-09-17.

- Decision (D18): In 初LEGEND the five レジェンドレッスン are the scenario's only lessons and are ordinary lessons for trigger purposes (they can be SP; under D4 all five count as SP). There are no other lessons; weeks 1, 2, 6, 15 are 授業. Resolves the open question carried from the design session.
  Rationale: User's play knowledge, confirmed by the wikiwiki 初LEGEND schedule.
  Date/Author: 2026-09-17 / user.

- Decision (D19): The 初LEGEND parameter cap is 3000 (the dump's `idolCardParameterGrowthLimit`), not the 2800 the plan carried from the sibling project.
  Rationale: User confirmation; the wiki's 2800 predates a later raise.
  Date/Author: 2026-09-17 / user.

- Decision (D20): 「試験・オーディション終了時」 counts every audition of the run including the final one (初LEGEND: 中間 + 最終 = 2), even though gains after the final audition cannot change the result.
  Rationale: User's call — the trigger fires and the community counts it; simpler and comparable with existing numbers.
  Date/Author: 2026-09-17 / user.

- Decision (D21): For H.I.F. one run is 選抜試験 (20 days) plus 本戦 (7 days and two rounds) together; no separate 本戦-only profile for memory replays.
  Rationale: The 選抜試験メモリー carries parameters into 本戦, so a card's contribution spans both; the user chose not to split.
  Date/Author: 2026-09-19 / user (route sheet Q1).

- Decision (D22): 本戦ラウンド1 and ラウンド2 count as auditions for 「試験・オーディション終了時」 (H.I.F. total 5 with the three 選抜試験), and a pre-audition recovery step precedes each 選抜試験 and ラウンド1, so 「試験・オーディション前の休憩後」 (P-item trigger) counts 4.
  Rationale: User's play knowledge (route sheet Q2, Q3).
  Date/Author: 2026-09-19 / user.

- Decision (D23): The 獲得時 sub-categories (メンタル / アクティブ / 好調・集中・やる気・好印象・強気・全力・温存・元気効果 / SSR) are hand-estimated counts, not the D10 "all conditions met" total. For H.I.F. the user set them on the assumption of roughly 20 acquisitions per run: メンタル 13, アクティブ 7, 好印象 14, the other effect groups 10, SSR 10 (元気 was left at the derived value and is flagged for review). D10 still governs stat- and count-conditional triggers (≥400, 20枚以上, 15枚以上).
  Rationale: Which effects the acquired cards carry is the most run-dependent quantity; treating every acquisition as matching every effect group overstates those cards ("definitely unreal" — user).
  Date/Author: 2026-09-19 / user (route sheet Q4 and overrides).

- Decision (D24): H.I.F. route profiles are the user's answers of 2026-09-19: 差し入れ育成 (差し入れ on days 1, 8, 14, 16 and 本戦 3; おでかけ on day 5; 相談 on 12, 19), おでかけ育成 (おでかけ on 5, 8, 14, 16, 本戦 3; 差し入れ on 1; 相談 on 12, 19) and a third profile the user has not named yet (差し入れ on 1, 8, 14, 本戦 3; おでかけ 5; 相談 12, 16, 19), each with run totals for 相談 purchases, 強化, 削除 and インターバル use recorded as comments in `data/scenarios/hif.ts`. パラメータボーナス base per stat = 800 (all-SP lessons) + 700 (選抜試験 rewards under maximum performance) = 1500. H.I.F. is the default scenario; the `RouteProfile` field is renamed `parameterBonusBase` because it is no longer only lesson gain.
  Rationale: Decision D2 — reference routes are curated from the user's play knowledge; the derivation and every input are kept next to the numbers so they can be re-derived.
  Date/Author: 2026-09-19 / user via `route-profiles.html`. Revised the same day: 相談 削除 totals 2/2/5, 元気効果 12 everywhere, third profile named 汎用コンテ育成.

- Decision (D25): Lesson-end triggers are per lesson stat in the game data (`p_trigger-end_lesson-lesson_{vocal,dance,visual}[_sp|_normal]`), so a route profile carries `lessons: { vocal, dance, visual }` (how many of the run's lessons train each stat, summing to the lesson count), the generator records `triggerStat` on every effect whose trigger is bound to a stat, and the engine caps such an effect's occurrences by `lessons[triggerStat]` in addition to the category count and the effect's own cap. Any-stat lesson triggers (`lesson_sp…`) are unaffected. `parameterBonusBase` is per stat and derives from the same split (H.I.F.: 800 × n/8 lesson gain + 340 × (8 − n)/16 sub-parameter share + 200 選抜試験 base + 500 × n/8 distributed share, overridable). Until the user supplies the split, shipped profiles carry the placeholder `lessons` = total for every stat (H.I.F. 8/8/8, 初LEGEND 5/5/5), which is equivalent to no cap.
  Rationale: The user pointed out that each lesson trains one chosen stat, so a Vo lesson-end skill cannot fire eight times in a route with three Vo lessons; the data confirms the triggers are stat-bound.
  Date/Author: 2026-09-19 / user (observation) and agent (mechanism). Superseded the same day by D26 for how the split is chosen.

- Decision (D26): The lesson split is not a fixed number per profile but a preset the player picks by deck build. Every profile carries six presets — for H.I.F.'s eight lessons 7/1/0, 7/0/1, 1/7/0, 0/7/1, 1/0/7, 0/1/7 (Vo/Da/Vi) — and the table scores each card under the preset that gives it the highest total (`scoreBest`), with a UI option to fix one preset. `parameterBonusBase` becomes a function of how many lessons train the stat: H.I.F. `round(800·n/8 + 340·(8−n)/16 + 200 + 500·n/8)` (lessons, sub-parameter share, 選抜試験 base, 選抜試験 distributed share), giving 1359 for 7 lessons, 511 for 1, 370 for 0. 初LEGEND's presets (4/1/0 family) and its function (selected gain of the n largest lessons plus non-selected gain of the rest) are the agent's analogy, pending the user's 初LEGEND sheet.
  Rationale: User: "the preference of which stat's lesson to pick depends on the support card build", so the sheet must not ask for one split; six presets cover every main/sub choice, and "best preset" is the maximum-performance reading of ADR 0001 for a card of a given stat.
  Date/Author: 2026-09-19 / user (presets), agent (best-preset scoring and bonus function).

- Decision (D27): The generators fail on every data shape the engine cannot score, not only on unmatched (effect type, trigger) pairs: a taxonomy-row hit whose effect type is neither Vocal/Dance/Visual nor in the audited `NON_PARAMETER_EFFECT_TYPES` list is unclassified (`unknown-effect-type`); an item effect type other than `ProduceEffect` / `ExamStatusEnchant`, an event reward resource other than a P-item (scored) or a skill card (skipped), and a skill-level effect that grants a P-item all throw. The nine non-parameter effect types the game's filter table lists (SP発生率+, スタミナ, Pポイント, 相談割引) are in the audited list and count in the generator's skipped report. Sorting in the generators uses code-unit order, not `localeCompare`. Kept as is after the same review: `Scenario.parameterCap` stays engine-unused metadata (a 点数 is marginal gain and the run's base parameters are unknown, so clamping would be wrong; documented on the type); `ProduceRewardSet` stays whitelisted (a random or player-selected pick, unscoreable under ADR 0001, and no support card skill or event uses one); the golden tests keep pinning totals only, since the breakdowns are the user's verification artefact in § Artifacts; a card event granting a P-drink now fails the build rather than being decided in advance (none exists in the data).
  Rationale: Codex review of the M0–M2 branch (2026-09-19) found three paths where new or misspelled game data would score 0 silently, contradicting ADR 0002's "fails loudly" and the M1 guard design; the fix generalises the existing allowlist-or-fail pattern instead of patching one site. Its claim that the scenario tests would accept an all-zero regression was rejected: the golden tests pin nine non-zero totals.
  Date/Author: 2026-09-19 / agent, from the Codex review; confirmed by the user 2026-09-20.


## Outcomes & Retrospective


Milestone 0 (2026-09-16): the join is proven end to end and the taxonomy approach holds, with one honest amendment — the game table alone covers 46 categories but not the five newest card triggers nor any P-item trigger, so a six-row audited extension list is needed (D13). The prototype also corrected three formula assumptions the design had made without data: per-skill activation caps (D15), unlimited-fire items (D16), and the own-event +50–100% multiplier that almost every card carries (D17). Lesson: reading every card's data, not two, is what surfaced all of these; the two sample cards alone showed none of them. Accepted 2026-09-17: the user verified both cards' level-60 values in game and accepted D13–D17 as proposed.


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

The upstream data is the GitHub repository `vertesan/gakumasu-diff`, a dump of the game's master tables as YAML, updated every few days (commits on 2026-09-10 and 2026-09-15). Files are fetched raw from `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml`. The tables this plan uses: `SupportCard.yaml` (card identity; fields `id`, `name`, `type`, `rarity`, `planType`, `assetId`, `supportCardLevelLimitId`), the four `SupportCardProduceSkillLevel*.yaml` (card level → skill level), `ProduceSkill.yaml` (skill id + level → up to three `produceEffectIdN`/`produceTriggerIdN` pairs), `ProduceEffect.yaml` (`produceEffectType`, `effectValueMin`, `effectValueMax`), `ProduceTrigger.yaml` (`phaseType`; conditions only in the id string), `SupportCardProduceSkillFilter.yaml` (taxonomy), `SupportCardLevelLimit.yaml` (凸 → level), `ProduceEventSupportCard.yaml` and `ProduceStepEventDetail.yaml` (card events, their unlock level, their effect ids including the granted P-item), and `ProduceItem.yaml` plus `ProduceItemEffect.yaml` for the granted item. The P-item join, discovered in Milestone 0, is: `ProduceEventSupportCard.yaml` (`supportCardId`, `number`, `supportCardLevel`, `produceStepEventDetailId`) → `ProduceStepEventDetail.yaml` row (`produceEffectIds`) → `ProduceEffect.yaml` row of type `ProduceEffectType_ProduceReward` whose `produceRewards[]` entry has `resourceType: ProduceResourceType_ProduceItem` and `resourceId: pitem_…` → `ProduceItem.yaml` row (`name`, `fireLimit` with 0 meaning unlimited, `skills[]` of `{produceTriggerId, produceItemEffectId}`) → `ProduceItemEffect.yaml` row (`effectType`; only `ProduceItemEffectType_ProduceEffect` rows carry a `produceEffectId` back into `ProduceEffect.yaml`; `ProduceItemEffectType_ExamStatusEnchant` rows are exam-time effects and score 0). Event parameter rewards are `ProduceEffect` rows of type `{Vocal,Dance,Visual}Addition` listed directly in the event detail's `produceEffectIds`. Support skills additionally carry `activationCount` (0 = unlimited, else the per-run cap) on their `ProduceSkill.yaml` row. Percent-type effects (`*GrowthRateAddition`) are stored in tenths of a percent (85 means 8.5%); permil types are in thousandths.

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


Milestone 0, working directory `/Users/ghensk/Developer/gakumas-supportcards`, as actually executed on 2026-09-16 (no `bun init`; `package.json`, `tsconfig.json` and `.gitignore` were written by hand so no boilerplate `index.ts`/`README.md` appeared):

    git checkout -b feature/m0-prototype-join
    BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache" bun add -d js-yaml @types/js-yaml @types/bun typescript
    bun scripts/prototype-join.ts s_card-3-0016 s_card-3-0073
    bunx tsc --noEmit

The `BUN_INSTALL_CACHE_DIR` override is only needed inside the coding agent's sandbox, which cannot write `~/.bun`; a normal shell runs plain `bun add`. `js-yaml` 4 has no default export under Bun's ESM loader, so the script imports `{ load }` by name. Tables are cached in `.cache/gakumasu-diff/` (gitignored); delete the directory to re-fetch.

Observed transcript (abridged):

    Loaded 14 tables in 2423 ms: SupportCard 202, ProduceSkill 1508, ProduceEffect 2117, ProduceTrigger 179, Filter 46, EventSupportCard 514, EventDetail 6894, ProduceItem 1068, ProduceItemEffect 961
    Processed 202 cards

    s_card-3-0016 1人たりとも欠ける事なく  SupportCardRarity_Ssr SupportCardType_Vocal ProducePlanType_Common asset=csprt-3-0016 levelLimit: 40/45/50/55/60
      凸0 (level 40)  own-event params +50%:
        [初期パラメータ上昇] vocal +52  (max 1/run; exact; @ p_trigger-produce_start-initial)
        [相談選択時パラメータ上昇] vocal +9  (unlimited; exact; @ p_trigger-start_shop)
      ...
      凸4 (level 60)  own-event params +100%:
        [初期パラメータ上昇] vocal +65  (max 1/run; exact; @ p_trigger-produce_start-initial)
        [相談選択時パラメータ上昇] vocal +14  (unlimited; exact; @ p_trigger-start_shop)
      event #1 (unlock lv1): params -; items pitem_00-3-028-0 みんなの教科書 (fireLimit=0: no parameter effect); other -
      event #2 (unlock lv20): params vocal +20; items -; other -
      event #3 (unlock lv40): params -; items -; other ProduceEffectType_ProduceCardUpgrade

    s_card-3-0073 ｖギャルピーーースッｖ  SupportCardRarity_Ssr SupportCardType_Vocal ProducePlanType_Plan3 asset=csprt-3-0073 levelLimit: 40/45/50/55/60
      凸4 (level 60)  own-event params +100%:
        [スキルカード削除時パラメータ上昇] vocal +11  (unlimited; exact; @ p_trigger-delete_produce_card-0000_0000-p_card_search-deck_all)
        [初期パラメータ上昇] vocal +65  (max 1/run; exact; @ p_trigger-produce_start-initial)
        [活動支給・差し入れ選択時パラメータ上昇] vocal +17  (unlimited; exact; @ p_trigger-start_present)
      event #1 (unlock lv1): params -; items pitem_03-3-184-0 しぼまない思い出 (fireLimit=0: no parameter effect); other -
      event #2 (unlock lv20): params vocal +20; items -; other -

    === Classification report ===
    Unclassified (effectType, trigger) pairs: 0
    Match statistics: exact 32658, prefix 32, via extension rows 268
    Taxonomy categories used by parameter effects: 40 of 52
    Cards with an own-event parameter bonus: 198
    Items granted by card events: 132
      (41 items with parameter effects, 91 without)

The script exits 1 when the unclassified count is not 0, printing each (effect type, trigger id) pair with the number of candidate rows and one card or item that uses it. The fix is never to drop the pair: either it is a non-parameter effect the taxonomy legitimately omits (add it to `NON_PARAMETER_EFFECT_TYPES` with a comment) or it needs an extension row (D13).

Milestone 1, as executed on 2026-09-17:

    bun run generate            # scripts/generate-taxonomy.ts && scripts/generate-cards.ts
    bun test                    # scripts/lib/*.test.ts (24 tests)
    bunx tsc --noEmit

Observed transcript:

    Wrote data/taxonomy.generated.ts: 46 game rows + 6 extension rows
    Wrote data/cards.generated.ts: 202 cards (199 with parameter effects)
    Wrote data/levelLimits.generated.ts: {"r":[20,25,30,35,40],"sr":[30,35,40,45,50],"ssr":[40,45,50,55,60]}
    Matches: exact 32633, prefix 32; categories used 44
    Skipped non-parameter effects: SupportCardProduceCardUpgradeProbabilityUp×10868, SupportCardEventStaminaRecoverUp×72, ...

Acceptance checks, using `GAKUMASU_DIFF_CACHE` to point the generator at a modified copy of `.cache/gakumasu-diff`:

    # copy of the tables with the 相談選択時パラメータ上昇 row deleted from SupportCardProduceSkillFilter.yaml
    Unclassified (effect type, trigger) pairs: 5
      ProduceEffectType_DanceAddition @ p_trigger-start_shop: no-row (e.g. s_card-2-0009 p_support_skill-common-p_trigger-start_shop-dance_addition-02-001)
      ...
      ProduceEffectType_VocalAddition @ p_trigger-start_shop-vocal-0400_0000: no-row (e.g. item pitem_03-2-123-0 切磋琢磨のタオル)
    exit=1
    # copy of the tables with the last SupportCard row deleted
    Card count would drop from 202 to 201; rerun with --allow-fewer if this is a real removal upstream.
    exit=1

The generated card file is 1.7 MB of source (13–17 breakpoints per card, long category ids) but 39 KB gzipped; whether Milestone 3 needs a leaner encoding is decided there from the measured bundle.

Milestone 2, as executed so far on 2026-09-17:

    bun test                    # src/engine/score.test.ts (12), data/scenarios/scenarios.test.ts (real data), scripts/lib (24)
    bunx tsc --noEmit

Observed:

    42 pass, 0 fail, 2181 expect() calls, 4 files

The route-profile sheet `route-profiles.html` at the repository root (untracked scratch, regenerated from `data/taxonomy.generated.ts` by a throwaway script) lists the 39 parameter categories a profile can count, prefilled for 初LEGEND, with empty H.I.F. columns and three questions; its "Copy answer (JSON)" button yields the object that `data/scenarios/hif.ts` is written from. Golden tests: `bun test --test-name-pattern "golden"` runs `data/scenarios/golden.test.ts` (nine cards, 凸0 and 凸4, plus the scenario-switch check). The values are the engine's own output, chosen to cover every mechanism and written out as hand-checkable breakdowns in § Artifacts; a future change to them must trace to a data or decision change.

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


Milestone 0 is accepted when the prototype prints zero unclassified effects over all cards and the two sample cards' values at level 60 equal the in-game display (the user checks in game or against hatsuboshi-library's card page). Status 2026-09-17: accepted — zero unclassified pairs (transcript above) and the user confirmed both cards' level-60 values in game.

Milestone 1 is accepted when `bun run generate` is idempotent (second run produces no diff), `bun test` passes, and deliberately corrupting the taxonomy file (delete one row) makes the generator exit non-zero naming the orphaned effect.

Milestone 2 is accepted when `score()` for a card with only an SP発生率 skill returns 0 in every 凸, a card with only P-point skills returns 0 with `parts` empty, and the golden cards match the numbers the user confirmed; and when switching the scenario argument from `hif` to `hajimeLegend` changes the totals without any code change.

Milestone 3 is accepted when the page at `http://localhost:5173` shows all cards, sorts by each 凸 column, filters by type/plan/rarity, shows the name on thumbnail hover, shows the breakdown on number hover, and reloading a URL with query parameters restores the same view.

Milestone 4 is accepted when `https://gakumas-supportcards.tia.run/` serves the page and `https://gakumas-supportcards.tia.run/img/img_general_csprt-3-0016_full.webp` returns HTTP 200 with `content-type: image/webp` and an immutable cache header.

Milestone 5 is accepted when a manual `workflow_dispatch` run on `main` produces either "no changes" or a PR touching only `data/`, and the PR's checks include the test run.

Milestone 6 is accepted when submitting the form creates an issue in `tia-tools/feedback` labelled `gakumas-supportcards`.


## Idempotence and Recovery


Generators overwrite their outputs wholesale and are safe to rerun; `git diff data/` is the review surface. The image upload script lists bucket keys first and uploads only missing ones, so a failed run is resumed by rerunning. `wrangler deploy` is idempotent. Nothing in this plan writes to the sibling repository.


## Artifacts and Notes


The grill-me session's raw decision log was kept at `$TMPDIR/grill-me-supoka-decisions.md` on 2026-09-16 and is fully transcribed into the Decision Log and Context sections above.

Golden breakdowns (Milestone 2, 2026-09-19), H.I.F. 差し入れ育成, best lesson-split preset, 凸4 unless noted; every factor is an in-game skill value, event reward or item value times a route count from `data/scenarios/hif.ts`, so each line can be checked by hand. Pinned in `data/scenarios/golden.test.ts`.

    1人たりとも欠ける事なく (SSR Vo)          凸0 109  凸4 147   Vo7/Da1/Vi0, event bonus +100%
      event 20 × 2.0 = 40 · 初期 65 × 1 = 65 · 相談選択時 14 × 3 = 42
    ｖギャルピーーースッｖ (SSR Vo)              凸0 190  凸4 256
      event 20 × 2.0 = 40 · 削除時 11 × 6 = 66 · 初期 65 × 1 = 65 · 差し入れ選択時 17 × 5 = 85
    大切な思い出、またひとつ (SSR Vo)          凸0 353.335  凸4 462.515
      event 40 · item 真夏に咲く太陽 集中獲得時 10 × 2 = 20 · 集中8枚以上獲得時 22 × 4 (cap 4) = 88 · 削除時 20 × 4 (cap 4) = 80
      · SPレッスン終了時 17 × 7 (8 SP lessons, 7 train Vo) = 119 · パラメータボーナス 8.5% × 1359 = 115.515
    愛無き暗記は難しい (SR Vo)                 凸0 181.5  凸4 213
      event 15 × 2.0 = 30 · item 打倒！墾田永年私財法 試験前の休憩後 26 × 4 (fireLimit 0 → route 4) = 104
      · 通常レッスン終了時 13 × 0 = 0 · 授業終了時 5 × 6 = 30 · 初期 49 × 1 = 49
    おやすみのふたり (SR Vo)                   凸0 161.296  凸4 267.976
      event 30 · SPレッスン終了時 13 × 7 = 91 · Pドリンク獲得時 6 × 10 (cap 10, route 16) = 60 · ボーナス 6.4% × 1359 = 86.976
    私たちも成長していくぞ！ (SSR assist)        凸0 140  凸4 190   no event bonus skill
      おでかけ終了時 Da 38 × 1 = 38 · 差し入れ選択時 Vi 38 × 2 (cap 2) = 76 · 相談選択時 Vo 38 × 2 (cap 2) = 76
    王子様のひと呼吸 (R Vo)                    凸0 37  凸4 60
      event 10 × 2.0 = 20 · 通常レッスン終了時 9 × 0 = 0 · おでかけ終了時 7 × 1 = 7 · 初期 33 × 1 = 33
    念入りにストレッチ (R Vi)                  凸0 40  凸4 74   Vo1/Da0/Vi7
      event 10 × 2.0 = 20 · レッスン終了時 3 × 7 = 21 · 初期 33 × 1 = 33 · 休む選択時 11 × 0 = 0
    きみは、自慢の生徒です (SSR assist)          凸0 0  凸4 0   no parameter effect


## Interfaces and Dependencies


Runtime and tooling: Bun (scripts, tests, package manager), Vite 7, Preact 10, Tailwind CSS v4 via `@tailwindcss/vite`, `js-yaml` for the generators, `uv` + GkmasObjectManager (GPL-3) for image extraction only (it never ships in the web bundle), `wrangler` for the Worker.

In `src/engine/types.ts`, define:

    export type Stat = "vocal" | "dance" | "visual";
    export type Totsu = 0 | 1 | 2 | 3 | 4;
    export interface ClassifiedEffect {
      categoryId: string;          // taxonomy row id (game row, or an `ext-` extension row per D13)
      stat: Stat;
      value: number;               // flat points, or tenths of a percent for パラメータボーナス+ (85 = 8.5%)
      kind: "skill" | "event" | "item";
      cap?: number;                // skills: ProduceSkill.activationCount; items: ProduceItem.fireLimit; absent or 0 = unlimited (D15, D16)
      itemId?: string;             // items only, for the breakdown label
    }
    export interface Breakpoint {
      minLevel: number;
      effects: ClassifiedEffect[];
      eventBonusPermil: number;    // own-event parameter multiplier at this level, 0 when none (D17)
    }
    export interface Card {
      id: string; name: string; assetId: string;
      type: Stat | "assist"; rarity: "r" | "sr" | "ssr";
      plan: "common" | "sense" | "logic" | "anomaly";
      breakpoints: Breakpoint[];
    }
    export interface RouteProfile {
      id: string; name: string;
      counts: Record<string, number>;          // categoryId -> occurrences per run
      lessonSplits: readonly LessonSplit[];    // presets {vocal, dance, visual} summing to the run's lesson count (D26)
      parameterBonusBase(lessonsOfStat: number): number; // run total of the gains パラメータボーナス+ multiplies for a stat trained by that many lessons (D4, D26)
    }
    export interface Scenario { id: string; name: string; parameterCap: number; profiles: RouteProfile[] }
    export interface ScoreParts { skills: number; events: number; items: number }
    export interface Score { total: number; byStat: Record<Stat, number>; parts: ScoreParts }

In `src/engine/score.ts`, define (as implemented 2026-09-17 — dependencies are passed in rather than imported, so tests use fixtures instead of the generated data):

    export interface ScoreContext { profile: RouteProfile; taxonomy: ReadonlyMap<string, TaxonomyRow>; limits: LevelLimits; lessons: LessonSplit }
    export function levelFor(limits: LevelLimits, rarity: Rarity, totsu: Totsu): number;
    export function resolveAtLevel(card: Card, level: number): Breakpoint;      // effects + eventBonusPermil in force at that level
    export function routeCount(profile: RouteProfile, taxonomy: ReadonlyMap<string, TaxonomyRow>, categoryId: string): number;
    export function scoreAtLevel(card: Card, level: number, ctx: ScoreContext): Score;
    export function score(card: Card, totsu: Totsu, ctx: ScoreContext): Score; // = scoreAtLevel at levelFor(...), under ctx.lessons
    export function scoreBest(card: Card, totsu: Totsu, ctx: Omit<ScoreContext, "lessons">): Score; // max over profile.lessonSplits (D26)
    export function taxonomyMap(rows: readonly TaxonomyRow[]): ReadonlyMap<string, TaxonomyRow>;

A lesson-bound effect (`ClassifiedEffect.triggerStat`, set by the generator from `p_trigger-end_lesson-lesson_{vocal,dance,visual}…`) fires at most `ctx.lessons[triggerStat]` times (D25); `Score.lessons` records the split used.

`Score` carries `lines: BreakdownLine[]` (one per effect: kind, category title, stat, raw value, count or factor, points, item name) in addition to `total`, `byStat` and `parts`, so the Milestone 3 tooltip needs no second computation. The `Scenario` object is not a parameter: a profile belongs to exactly one scenario and carries everything the score needs.

`score` sums, over resolved effects, with `count(categoryId)` = `profile.counts[categoryId]`, falling back to `profile.counts[countsAs]` for an extension row that names one, else 0, and `occurrences = cap ? min(cap, count) : count`: for `kind === "skill"` with the パラメータボーナス+ category, `value/1000 × profile.parameterBonusBase[stat]`; for other skills, `value × occurrences` (D15); for events, `value × (1 + breakpoint.eventBonusPermil/1000)` (D17); for items, `value × occurrences` (D16). Categories the profile does not name count 0; the generator's taxonomy test asserts every category id in every shipped profile exists in the taxonomy, so a typo fails the build. (Formulas as amended by decisions D13–D17, accepted 2026-09-17.)

Open question carried to Milestone 2: whether 初LEGEND Legend lessons should be treated as SP lessons for trigger purposes (they are a distinct lesson kind in that scenario). Resolve with the user before writing `hajime-legend.ts`; record the answer in the Decision Log. A second open question from Milestone 0: the dump gives 初LEGEND's `idolCardParameterGrowthLimit` as 3000, not the 2800 stated in Context and Orientation; confirm which the game shows today before writing `hajime-legend.ts`.


## Revision notes


- 2026-09-16 (Milestone 0 executed): Progress, Surprises & Discoveries, Decision Log (D13–D17, proposed), Outcomes & Retrospective, Context (P-item join path), Concrete Steps (actual commands and transcript), Validation (status) and Interfaces (`cap`, `eventBonusPermil`, amended `score` formula) updated to reflect what the prototype found. Reason: the design's formulas for skills, items and events were written before any data was read; the data showed per-skill caps, unlimited-fire items, an own-event multiplier and gaps in the game's filter table, and the plan must carry those so Milestone 1 does not re-discover them.
- 2026-09-17 (Milestone 0 accepted): the user verified both sample cards in game and accepted D13–D17; Progress, Decision Log, Outcomes, Validation and Interfaces stamped accordingly; ADR 0002 received an addendum and the `CLAUDE.md` index line for it was updated.
- 2026-09-17 (Milestone 1 executed): Progress, Concrete Steps (commands, transcript, acceptance evidence) and Surprises (redundancy-guard rule, generated file size) updated; the prototype script was removed as planned. Reason: the plan must show the generators' real behaviour and guards so Milestone 2 can build on the committed data without rereading the code.
- 2026-09-17 (Milestone 2 engine built, profiles pending): Progress split into completed/remaining, Concrete Steps and Interfaces updated to the implemented signatures (`ScoreContext`, explicit `limits`, `lines` on `Score`). Reason: the engine's real interface differs from the sketch (dependencies passed in for testability), and the next session must know that H.I.F. counts and three answers are still owed by the user before golden tests can exist.
- 2026-09-19 (H.I.F. profiles landed): Surprises gained the H.I.F. structure and the 初LEGEND lesson correction; Decision Log D18–D24; Progress and Interfaces (`parameterBonusBase`) updated. Reason: the first route sheet asked the user for numbers the schedule fixes and rested on a wrong 初LEGEND model; the plan now carries the researched schedules and the user's actual route choices so the profiles can be re-derived rather than trusted.
- 2026-09-20 (D27 confirmed, M0–M2 merged): D27 stamped as confirmed; the fail-loud generalisation of the generators (unknown effect types, item effect types, event reward resources, skills granting P-items) committed on `feature/m2-engine`, then the M0→M2 stack merged into `main` in order with merge commits. Reason: Milestone 3 branches from `main`, so the engine and data it builds on must be on the default branch first.
