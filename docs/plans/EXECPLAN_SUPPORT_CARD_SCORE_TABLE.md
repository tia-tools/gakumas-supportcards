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
- [ ] Milestone 2 (partially completed 2026-09-17, branch `feature/m2-engine` stacked on M1): completed — `src/engine/score.ts` (`levelFor`, `resolveAtLevel`, `routeCount`, `score`, `scoreAtLevel`, breakdown lines) with 12 unit tests; `RouteProfile`/`Scenario`/`Score` types; `data/scenarios/hajime-legend.ts` with a provisional 標準 profile derived from the plan's week table (guesses marked in the file); `data/scenarios/scenarios.test.ts` checks every profile's category ids against the taxonomy and scores all 202 cards at every 凸 (42 tests pass in total); spot check under that profile: 1人たりとも欠ける事なく 凸4 = 161 (65 初期 + 14×4 相談 + 20×2.0 event), ｖギャルピーーースッｖ 凸4 = 206. (2026-09-19) H.I.F. researched from both wikis, `route-profiles.html` rebuilt as a derivation sheet (choice days per profile, play-style parameters, derived counts with overrides, four questions), answered by the user; `data/scenarios/hif.ts` written from the answer with three profiles (D21–D24), H.I.F. made the default, `parameterBonusBase` rename, 初LEGEND corrected to five lessons / four 授業 / two auditions (D18–D20; other counts still guesses). 48 tests pass. Spot check, 差し入れ育成 凸4: 1人たりとも欠ける事なく 147, ｖギャルピーーースッｖ 278. (2026-09-19, later) User's revised answer applied (相談 削除 2/2/5, 元気効果 12, third profile 汎用コンテ育成); lesson-end triggers found to be stat-bound → `triggerStat` on effects, six lesson-split presets per profile, `parameterBonusBase(n)` as a function, `scoreBest` picking the best preset per card (D25, D26); card data regenerated; 56 tests pass. Spot check, 差し入れ育成 best preset 凸4: 1人たりとも欠ける事なく 147, ｖギャルピーーースッｖ 256, 大切な思い出、またひとつ 462.5 (Vo7/Da1/Vi0). Golden tests pinned in `data/scenarios/golden.test.ts` for nine cards chosen to cover every mechanism (breakdowns in § Artifacts); the values are engine-derived and the user verifies the breakdowns rather than supplying numbers (the user does not track community values). Remaining — the user's verification of those breakdowns. The 初LEGEND route sheet that would replace the guesses (including its presets) is deferred by D38 (2026-09-21): H.I.F. goes end to end first.
- [ ] Milestone 3 (started 2026-09-20, branch `feature/m3-ui` from `main` after the M0→M2 stack was merged): built — Vite 8 + Preact 10 + Tailwind CSS 4 scaffold (`index.html`, `vite.config.ts`, `src/main.tsx`, `src/index.css`; `bun run dev` / `build` / `preview`); `src/app/url-state.ts` (the view state and its query-string encoding, only non-default values written, unknown values fall back, count overrides keyed `c.<category id minus its prefix>` with an `ext-` marker for extension rows and a uniqueness check over the real taxonomy); `src/app/rows.ts` (`applyOverrides`, `buildRows` at 凸0–凸4 under the best preset or a fixed one, `filterRows`, `sortRows` with 0-point rows last in either direction, `formatPoints`); components `App`, `Controls` (scenario / 育成ルート / レッスン配分 selects, type / plan / rarity toggles), `ScoreTable` (sticky header, thumbnail with the name on hover and a text fallback until the image library exists, rarity / plan / type badges, 「パラメータ効果なし」 tag, sortable 凸 headers, breakdown popover from `Score.lines` with the lesson split and per-stat totals), `CustomizePanel` (folded `<details>`, one number input per counted category in game order, 既定に戻す), `useUrlState` (read on load and popstate, `replaceState` on change). 19 new unit tests (95 total); both modules shown red under mutation (zero-last rule dropped; override parsing inverted). `bun run build`: 1.7 MB JS, 58 KB gzipped — data stays inline (D28). Dev server verified by fetching every module through Vite (200, no transform errors); visual acceptance by the user 2026-09-20: sorting, filters, number hovers and reloading a URL with query parameters all confirmed; thumbnails show the name fallback because the image library is Milestone 4 (ADR 0003) and does not exist yet. ESLint was attempted the same day and abandoned by the user's decision (D29: TypeScript 7 has no JS API, so typescript-eslint and eslint-plugin-sonarjs cannot load; revisit at Milestone 5 or when typescript-eslint supports TS 7). Remaining — the golden-breakdown verification and 初LEGEND route sheet still open from M2. Untracked scratch pages at the repository root (`taxonomy-gap-explained.html`, `decisions-d13-d17.html`, `route-profiles.html`) are not to be committed; delete when no longer needed.
- [x] (2026-09-21) Milestone 4 (started 2026-09-20, branch `feature/m4-images` from `main` after M3 was merged): built and verified locally — `scripts/images/` (uv project; `thumbnail.py` naming and 192 × 108 webp, `decode.py` Unity-version fallback, `uploads.py` upload planning and the released-cards-only rule, thin CLIs `extract.py` and `upload.py`; 12 pytest tests, shown red under two mutations) and `infra/worker/` (`img.ts` handler over a bucket passed in, `worker.ts`, `wrangler.toml` with static assets + R2 binding, `README.md`; 7 bun tests, shown red under two mutations; 102 bun tests in total). Full extraction run: 204 of 204 images converted in 15 s, 1.3 MB of webp from 126 MB of bundles; all 202 cards in the data had an image, and two images (`csprt-2-0080`, `csprt-3-0109`) belonged to cards not in the data yet and were held back from upload (D32) until the data update of 2026-09-20 added them. (2026-09-21) Layout changed per D35: every card now has a private lossless master and the public thumbnail; re-extraction wrote 204 masters (219 MB, 2048 × 1024) and 204 thumbnails (1.3 MB) in 2 min 27 s, the upload dry run plans 408 writes (master before thumbnail for each of 204 cards), the Worker and the dev server answer `/img/w192/…` and refuse `/img/master/…`; 16 pytest and 103 bun tests pass, the three new rules shown red under mutation. (2026-09-21, later) The user ran the Cloudflare steps: the Worker is deployed and all images are uploaded; verified from outside — `/` 200 `text/html`, `/img/w192/img_general_csprt-3-0016_full.webp` 200 `image/webp` 6 216 B at 192 × 108, `/img/master/…` 404. The user then found the masters vertically squashed; cause and fix are D36: masters re-encoded at 2048 × 1152 (204 files, 265 MB, 2 min 43 s), 18 pytest tests pass with the shape rule shown red under mutation, the superseded local folder `out/webp` removed at the user's request. The user re-sent the masters the same day; two of them still looked squashed in the dashboard, which a checksum test traced to the browser cache and an immutable header on masters, not to the bucket (Surprises, D37); the uploader now gives masters `private, no-cache` (19 pytest tests, the rule shown red under mutation). The user ran that last masters-only upload, and the acceptance checks pass from outside: `/` → 200 `text/html`; `/img/w192/img_general_csprt-3-0016_full.webp` → 200 `image/webp` with `cache-control: public, max-age=31536000, immutable`; `/img/master/img_general_csprt-3-0016_full.webp` → 404 `no-store` although the object is in the bucket; the thumbnail of `csprt-3-0109`, a card released in the 2026-09-20 data update, → 200. Milestone 4 is complete. `wrangler deploy --dry-run` accepts the configuration (Worker 1.87 KiB, bindings `IMAGES` → `tia-assets`, `ASSETS`). The dev server now answers `/img/*` from `scripts/images/out/webp`, so the table shows real thumbnails locally (verified: `csprt-3-0016` → 200 `image/webp` 6 216 B; out-of-scheme paths are not served). Remaining, all requiring the user's Cloudflare account — `bunx wrangler login` with the project account, enable R2, `bunx wrangler r2 bucket create tia-assets`, `bun run build` + `bunx wrangler deploy`, `uv run upload.py --assume-empty`, then the acceptance `curl` checks in `infra/worker/README.md` § Verify.
- [x] (2026-09-20) Data update, done by hand ahead of Milestone 5's automation: upstream `vertesan/gakumasu-diff` commits of 2026-09-18 and 2026-09-20 pulled (old cache moved aside, tables re-fetched, `bun run generate`). Result: 204 cards (201 with parameter effects), up from 202 — new cards `s_card-2-0080` 激辛！　初星カレー！！ and `s_card-3-0109` わたしに、まかせて — and a taxonomy of 49 game rows + 4 extension rows (was 46 + 6). The game added three filter rows: 相談でスキルカード交換後 (order 42), 温存 8枚以上 (41) and a new 全力 8枚以上 (40). The first two made two of our extension rows redundant, and the generator refused to write until they were deleted from `data/taxonomy.extensions.ts` — the D13 retirement guard firing for the first time on live data, exactly as designed. Because a game row has no `countsAs`, every route profile now names the two official 8枚以上 rows explicitly with the same count as their unconditional 獲得時 row (D13's rule, written out), and the 相談でスキルカード交換後 count moved from the `ext-` key to the official id with its value unchanged. Verified: all 808 (card, profile) score rows of the previous data are unchanged at every 凸; 102 bun tests pass; regeneration is byte-identical; the two new cards are exactly the two images Milestone 4's uploader was holding back (D32), so the upload now plans 204 images and holds back none. H.I.F. 差し入れ育成 凸4: 激辛！　初星カレー！！ 169, わたしに、まかせて 404.5.
- [x] (2026-09-22) Milestone 5 (started 2026-09-22, branch `feature/m5-weekly-update` from the new `develop`; unblocked by `docs/plans/EXECPLAN_COUNTING_MODEL.md`, which was merged into `main` that day, and `main` pushed to `origin` at the user's request): built and verified locally — `.github/workflows/update-data.yml` (weekly and by hand: regenerate from fresh tables, stop quietly when nothing changed, otherwise gates, best-effort images, pull request, merge commit, held-cards issue, back-merge into `develop`, then deploy) and `.github/workflows/deploy.yml` (every push to `main` that touches the page, data or Worker, plus on call and by hand); `scripts/lib/update-report.ts` with `scripts/update-report.ts` (pull-request and issue texts from two score snapshots and the held list); `scripts/lib/workflows.test.ts` (parses both workflows and pins triggers, permissions, gate order, the best-effort boundary, merge style, no expression spliced into a script); `scripts/images/extract.py --only-missing`, `deployed_site.py`, `missing_file_names`, the committed `GkmasObjectManager.sha` and `fetch-vendor.sh`. 170 bun and 20 pytest tests pass; the gate-order and best-effort tests shown red under mutation; `--only-missing` run against the live site found 0 of 204 missing; the three action tags verified to exist. Not verifiable locally: the workflows themselves. (2026-09-22, later) The user created an account-owned token `gakumas-supportcards-github-actions-deploy` with Editor on this Worker, Workers Routes on `tia.run` and Workers R2 Storage, stored the two secrets, and allowed Actions to create pull requests. Released through `develop` into `main` (`8221be5`) and pushed at the user's request. Accepted: the push started Deploy run 35684487911 by itself, every step green, and the live page's script hash equals the local build; the first manual "Update data" run (35689624266) regenerated 204 cards from fresh tables, found no change, printed "No changes upstream; nothing to publish." and skipped the deploy job. The pull-request half of the workflow — gates, images, merge, held-cards issue, back-merge, deploy — has not yet run on real data and will first be exercised by the scheduled Monday run, or sooner by a manual run from a branch whose committed data is one update behind. Milestone 5 is complete as far as it can be verified today.
- [x] (2026-09-24) Milestone 6 (started 2026-09-23, branch `feature/m6-feedback` from `develop`): in-app feedback form → Worker `/feedback` → private `tia-tools/feedback` issues. Built and verified locally: `infra/worker/feedback-contract.ts` (categories, limits and the patterns for the attached view and build, shared by page and Worker), `infra/worker/feedback.ts` (`parsePayload`, `composeIssue`, `dailyBucket`, `handleFeedback` over injected store, secrets, GitHub and clock; `createGitHubIssue`), `worker.ts` routing `/feedback`, `wrangler.toml` with `/feedback` in `run_worker_first` and the KV binding `FEEDBACK_LIMITS`; on the page `src/app/feedback.ts` (`viewToAttach`, `buildPayload`, `resultText`) and the folded `FeedbackForm.tsx` under the table, with the build commit from `git rev-parse` injected by `vite.config.ts` as `__BUILD_COMMIT__`. 186 bun tests pass (17 new); the per-day limit, the salt guard, the view pattern, the GitHub-failure rule and the page's re-encoding each shown red under mutation; type check clean; `bun run build` 57 KB gzipped; `wrangler deploy --dry-run` lists the three bindings. The label `gakumas-supportcards` was created in `tia-tools/feedback` on 2026-09-23 at the user's approval (D42). (2026-09-24) The user created the KV namespace `gakumas-supportcards-feedback`; its id `9837b184f0a343b78db446d26690aa3a` is in `wrangler.toml` under the binding `FEEDBACK_LIMITS`, and the dry run lists it. The user then created the issues-only fine-grained token and set the Worker secrets `FEEDBACK_TOKEN` and `HASH_SALT` (a first `HASH_SALT` attempt stored an empty value because a pasted line break split the command; the handler treats an empty salt as missing, and the rerun replaced it); `wrangler secret list` shows both. Released through `develop` into `main` (`a94a65c`) and pushed at the user's request; Deploy run 35918482597 succeeded on the first try, so the CI deploy token needed no KV permission for the new binding. Checked from outside: `POST /feedback` with `{}` → 400 `{"ok":false}`, `GET /feedback` → 405, the thumbnail of `csprt-3-0016` still 200 `image/webp`, its master still 404, and the live script `index-BwGLjEKf.js` equals the local build and carries the commit `a94a65cda7f8`. Accepted: the user sent a message from the live form, and `tia-tools/feedback` issue #8 appeared, titled `[要望] フィードバックフォームが一番下に置かれていて気付きにくい`, labelled `gakumas-supportcards` and `request`, its message fenced (backticks typed in the message stayed literal), with the default-view link and build `a94a65cda7f8`. The issue itself asks for two changes to the page — make the form easier to find than at the very bottom, and drop the footer sentence 「カードデータは vertesan/gakumasu-diff から毎週生成。」 — which are follow-up work, not part of this milestone. Both were done the same day on `feature/feedback-placement`: a 「フィードバック」 link beside the page title opens the form, scrolls to it and focuses the message box (`FeedbackLink`, the user's choice over moving the form to the top or a floating button), and the footer keeps only the scenario and its parameter cap; the user checked both in the dev server.


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


- Observation: `typescript@7.0.2` (the native, Go-based compiler) ships only `lib/tsc.js` and no compiler API: `require("typescript")` yields an object without `TypeFlags` or `createProgram`. `typescript-eslint` 8.70 declares `typescript >=4.8.4 <6.1.0`, and `eslint-plugin-sonarjs` loads `ts-api-utils` at import time, which crashes on that object even before any rule runs — so ESLint cannot start in this repository at all, type-aware rules or not.
  Evidence: `bunx eslint .` on 2026-09-20 → `TypeError: Cannot read properties of undefined (reading 'Intrinsic') at ts-api-utils/lib/index.cjs:787` from `eslint-plugin-sonarjs/cjs/S6759/rule.js`; `node -e "require('typescript').TypeFlags"` prints `undefined`.

- Observation: GkmasObjectManager cannot be a declared dependency. It is a public GPL-3.0 GitHub repository (`AllenHeartcore/GkmasObjectManager`) with only a `requirements.txt` — no `pyproject.toml`, no `setup.py`, not on PyPI — so the plan's "`uv sync` then import it" does not work as written. It is unpacked from a source tarball pinned to a commit into the gitignored `scripts/images/vendor/`, its requirements are listed in our own `scripts/images/pyproject.toml`, and it is imported by putting the checkout on `sys.path`.
  Evidence: 2026-09-20, `https://pypi.org/pypi/GkmasObjectManager/json` → Not Found; `pyproject.toml` and `setup.py` → HTTP 404 on the repository's `main`; pinned commit `2d378780786f561a3c94e1cc171e275bfac0d38d`. A `git clone` also fails inside the coding agent's sandbox, which refuses writes into `.git/hooks`; the tarball avoids git metadata entirely.

- Observation: Support card art objects are Unity asset bundles named `img_general_csprt-{rarity}-{nnnn}_full.unity3d` — the `.unity3d` suffix is part of the manifest name, so a pattern anchored at `_full$` matches nothing. The manifest (version 205100:0061) lists 204 of them, 132 MB in total, against 202 cards in `SupportCard.yaml`; ids run `csprt-1-0000` to `csprt-3-0110`. The manifest comes from `api.asset.game-gakuen-idolmaster.jp` and the objects from `object.asset.game-gakuen-idolmaster.jp` (the object URL template is part of the manifest response).
  Evidence: probe scripts run 2026-09-20 with `gom.fetch()` and `m.search(...)`: strict pattern 0 matches, `img_general_csprt-\d-\d{4}_full\.unity3d$` 204 matches, `type: GkmasAssetBundle`, sizes 141 073–922 552 bytes.

- Observation: GkmasObjectManager's built-in image conversion is broken for current bundles, and fails silently. The bundles have their Unity version stripped (`0.0.0`), so UnityPy parses them with `UnityPy.config.FALLBACK_UNITY_VERSION`, which the library hard-codes to `2022.3.21f1`. The game has since moved to a newer engine: under the 2022 layout the Texture2D of `csprt-3-0016` parses as 1024 × 935 712 px with an empty stream path, the pixel lookup then raises `TypeError` with an empty message, and the library catches it and writes the raw `.unity3d` instead of a PNG (`Conversion failed, fallback to rawdump.`). Under `2023.2.20f1` or any `6000.x` version the same bundle parses as 2048 × 1024, format 50 (ASTC), streamed from the bundle's own `.resS`, and decodes to an opaque RGBA image. Calling UnityPy without any fallback version misreads the bundle flags as "encrypted, no key provided"; that is the same version problem, not encryption — nothing needs a key. Every bundle sampled afterwards, from the oldest R card (`csprt-1-0000`) to the newest SSR (`csprt-3-0110`), needs the newer layout, and the full run decoded all 204 with it, so the game rebuilt its whole archive and the library's converter is broken for every card, not only new ones. Our decoder still tries candidate versions per bundle and accepts the first plausible parse, so the next engine upgrade is a one-line change.
  Evidence: 2026-09-20 local probes on the downloaded bundle, no network: versions `2021.3.30f1`, `2022.3.21f1`, `2022.3.62f1` → junk dimensions; `2023.2.20f1`, `6000.0.23f1`, `6000.0.58f1`, `6000.1.10f1`, `6000.2.6f1` → `2048x1024 fmt=50 ... -> decoded (2048, 1024) RGBA`, alpha extrema (255, 255).

- Observation: The card texture is stored squashed at 2:1 (2048 × 1024) and is meant to be shown at 16:9; the library's own README resizes cards with `image_resize="16:9"`. Resized to 192 × 108 (exactly 2× the table's 96 × 56 cell) and encoded as webp quality 80, `csprt-3-0016` is 6 216 bytes (quality 70: 5 072, quality 90: 8 904), so the whole library is about 1.2 MB. The library's converter always saves at quality 100, another reason to do the resize and encode ourselves.
  Evidence: probe of 2026-09-20; preview rendered at 768 × 432 shows natural proportions and correct orientation.

- Observation: Three coding-agent sandbox limits shaped how Milestone 4 is run, none of them a project problem: `uv` panics inside the sandbox while reading macOS system network configuration (run `uv sync` outside it); the sandbox denies reading any `*.pem`, which includes certifi's public CA bundle, so sandboxed Python HTTPS needs `REQUESTS_CA_BUNDLE` and `SSL_CERT_FILE` pointed at a CA bundle saved under another extension (the Mozilla bundle from `https://curl.se/ca/cacert.pem`); and `gh` fails TLS verification there while `curl` works. A normal shell needs none of this.
  Evidence: `uv sync` → `Attempted to create a NULL object` in `system-configuration/dynamic_store.rs`; `requests` → `Could not find a suitable TLS CA certificate bundle, invalid path: .../certifi/cacert.pem`; `gh api` → `x509: OSStatus -26276`.

- Observation: When the game catches up with an extension row, it does so with its own id and without any alias, so retirement is not only a deletion. The extension 温存 8枚以上 row shared its count through `countsAs`; its official replacement is an ordinary row, which a profile must count explicitly or it scores 0 (the scenarios test catches the omission). The customize panel therefore now shows the 8枚以上 rows as their own inputs, and overriding 温存効果のスキルカード獲得時 no longer moves the 8枚以上 count with it, while the two remaining extension variants (好印象, 集中) still follow their base row. URL override keys for a retired row change too (`c.ext-buy_shop_item_produce_card` → `c.buy_shop_item_produce_card`); an old shared link silently loses that one override.
  Evidence: first `bun run generate` on 2026-09-20 exited 1 with "Extension rows now covered by the game's filter table — delete them from data/taxonomy.extensions.ts" naming both rows; after the profile edits the old-versus-new comparison printed `score rows compared: 808 | changed: 0`.

- Observation: The Cache-Control given to `wrangler r2 object put` is stored with the object and returned on every download, including downloads through the Cloudflare dashboard — not only on requests that go through our Worker. `upload.py` stamped every object, private masters included, with `public, max-age=31536000, immutable`. After the masters were overwritten with their display-shape versions (D36), the user still saw `master/img_general_csprt-1-0000_full.webp` and `…-0001…` vertically squashed in the dashboard and in files downloaded from it, while the local files were correct: those were the two masters the user had opened before the re-upload, and the browser kept serving its year-long immutable copies without asking the server. The bucket was never stale.
  Evidence: 2026-09-21, fetched outside any browser with `bunx wrangler r2 object get tia-assets/master/img_general_csprt-1-0000_full.webp --file /tmp/m0000.webp --remote && md5 -q /tmp/m0000.webp` → `aade9f053fc7412837ba827e83b5e605`, identical to `md5 -q scripts/images/out/master/img_general_csprt-1-0000_full.webp`; all 204 local masters are 2048 × 1152. The agent had wrongly told the user earlier the same day that masters have no caching concern because they are never served.

- Observation: Cloudflare replaced its Workers API-token permissions with granular roles on 2026-09-15, one week before Milestone 5 needed a token, and the reference pages had not caught up: `developers.cloudflare.com/fundamentals/api/reference/permissions/` and the GitHub Actions guide still name "Workers Scripts Edit" and the "Edit Cloudflare Workers" template, while the dashboard already marks "Workers Scripts" legacy. The new model (`developers.cloudflare.com/workers/authorization/`) has four roles — Metadata Read-Only, Content Read-Only, Editor, Admin — at product or single-Worker scope; "Workers Scripts Edit" maps to Editor at product scope, and CI/CD is told to use an account-owned token with Editor on one Worker. Routes and custom domains still need the zone permission "Workers Routes" beside it, and R2 keeps its account-level "Workers R2 Storage" permission (per-bucket roles are announced as future). Legacy permissions keep working with no deprecation date. Account-owned tokens (`cfat_` prefix, optional expiry) are what Cloudflare recommends for CI/CD; they need Super Administrator to create.
  Evidence: changelog `developers.cloudflare.com/changelog/post/2026-09-15-granular-worker-permissions/`, blog `blog.cloudflare.com/workers-granular-authorization/`, and the authorization pages, read 2026-09-22 after the user noticed the legacy label. The agent's first token advice that day used the legacy names; `infra/worker/README.md` now carries the granular ones.

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

- Decision (D28): The generated card data ships inline in the single JS bundle; no leaner encoding, no code splitting, no runtime fetch. `vite.config.ts` raises `chunkSizeWarningLimit` to 2000 KB with the reason and removal condition in a comment. The UI resets count overrides when the scenario changes (they are meaningless across scenarios) but keeps them across profiles of one scenario. Overrides are keyed in the URL by the category id minus its common prefix (`c.start_shop=4`), extension rows as `c.ext-…`.
  Rationale: Milestone 1 deferred the encoding question to the measured bundle; measured 2026-09-20 at 1.7 MB minified / 58 KB gzipped, which is a small page load, and a second format would be a second thing to keep in sync with the generator. Rejected: JSON fetched at runtime (an extra round trip and a loading state for 58 KB), a compact per-card encoding (more code, same gzip size order).
  Date/Author: 2026-09-20 / agent; confirmed by the user 2026-09-20 after an explanation of the measured sizes and the rejected alternatives.

- Decision (D29): ESLint is not set up while the project is on TypeScript 7. The policy stack (`tseslint.configs.strict`, sonarjs, security, size and complexity limits as errors, per `~/.claude/docs/typescript.md` § Lint & static-analysis policy) needs TypeScript's JS compiler API, which TypeScript 7 does not ship (see Surprises). The options were pinning `typescript` to 6.0 or 5.9 so the stack could run, or keeping TypeScript 7 without ESLint; the user chose the latter. Revisit at Milestone 5 (CI) or as soon as typescript-eslint supports TypeScript 7. Until then `bun run type-check` (strict, `noUnusedLocals`, `noUncheckedIndexedAccess`) and `bun test` are the only gates. The ESLint packages and the drafted `eslint.config.js` were removed; the draft mirrored `mulmoterminal/eslint.config.js` (warn-to-error transform, generated data ignored, test-file exceptions for non-null assertions and function length, security plugin tuned for id-keyed lookups) and can be recreated from that reference.
  Rationale: The user prefers the native compiler over a downgrade for the sake of lint; the code base is small enough that type-check plus tests carry the gate for now. The cost is that the global Quality Gates (size and complexity as lint errors, no `as` casts, no `!`) are unenforced until then, so reviews must watch for them by eye.
  Date/Author: 2026-09-20 / user.

- Decision (D30): Images reach R2 through `wrangler r2 object put`, and "which images are missing" is asked of the deployed site with one `HEAD /img/<key>` per image. Replaces the plan's original "upload via the R2 S3 API". The Worker therefore answers a missing image with `404` and `Cache-Control: no-store`, so a miss is never cached; only 200 and 404 count as answers and any other status stops the upload run; `--assume-empty` covers the first run before the site exists.
  Rationale: One credential type instead of two — the Wrangler login locally and a single `CLOUDFLARE_API_TOKEN` in CI (Milestone 5) — with no S3 key pair to create, store and rotate, and no `boto3`. Planning needs no credentials at all, so `--dry-run` works for anyone. Rejected: listing the bucket over the S3 API (needs an R2 access key pair in a local `.env` and as CI secrets). Wrangler has no bucket-listing command, which is why the check goes through the site.
  Date/Author: 2026-09-20 / proposed by the agent, chosen by the user.

- Decision (D31): GkmasObjectManager is used only to fetch and decrypt the manifest and to download de-obfuscated bundles (`convert_image=False`); decoding, resizing and encoding are ours. It lives as a source tarball pinned to a commit in the gitignored `scripts/images/vendor/` (it is not a package; see Surprises), with its requirements listed in `scripts/images/pyproject.toml`. `decode.py` tries candidate Unity versions (`UNITY_VERSIONS`, newest first) and accepts the first Texture2D whose dimensions are plausible (1–8192 px); a bundle no candidate decodes fails the run by name. Thumbnails are 192 × 108 (16:9, twice the table's 96 × 56 cell), opaque RGB, webp quality 80.
  Rationale: The library's converter hard-codes a stale Unity version and falls back to a raw dump without failing, which would have shipped 204 non-images; owning the conversion makes the failure loud and the fix a one-line version bump, and keeps the rules (naming, size, plausibility) in pure functions with tests. Its converter also always saves at quality 100. Rejected: patching the vendored checkout (unreviewable drift from the pinned commit), setting UnityPy's global fallback from our script and keeping the library's converter (still silent on failure, still quality 100).
  Date/Author: 2026-09-20 / agent, from the Milestone 4 probes; confirmed by the user 2026-09-21 together with D35, which adds a full-size master to what is stored.

- Decision (D32): Only art for cards present in `data/cards.generated.ts` is uploaded. `upload.py` holds back every other extracted image and prints which ones.
  Rationale: The game's asset manifest carries art ahead of release — two of the 204 images on 2026-09-20 have no card in the data — and publishing those under guessable filenames would leak unreleased cards. Held-back images go out on the first upload after the weekly data update adds their cards, which is also exactly Milestone 5's "upload new images for any assetId not yet in the bucket".
  Date/Author: 2026-09-20 / agent; confirmed by the user 2026-09-21.

- Decision (D35): The image library stores two renditions of every card, in one bucket under one file name and two prefixes. `master/img_general_{assetId}_full.webp` is the decoded texture as lossless webp at its own size (2048 × 1024 today, deliberately not stretched to 16:9, alpha kept only when it carries something); it is private — the Worker's path rule only ever matches `w192/`, so a master cannot be fetched from the web even though it is in the bucket, and a test pins that. `w192/img_general_{assetId}_full.webp` is the 192 × 108 thumbnail of D31 and the only public image, at `/img/w192/…`. A future size is a new prefix, never a rename. The uploader writes the master before the thumbnail, so a served thumbnail always implies a stored master even when a run dies between the two, which lets "what is missing" keep being asked of the public site (D30). This amends `docs/adr/0003`, which said only a downscaled webp is stored.
  Rationale: User, 2026-09-21: "holding the raw size image would be better to be used in the future". Re-extracting later is weaker than it sounds — the game can replace or remove assets, and the extraction library's converter already broke once on an engine change. Measured on 12 of the 204 cards: lossless webp 1.04 MB per card (about 213 MB for all; the real run produced 219 MB), PNG 1.41 MB (287 MB), webp quality 90 0.24 MB (48 MB); R2's free tier is 10 GB, so the master can afford to lose nothing. Masters stay private because storing is not publishing: serving full-resolution game art raises redistribution exposure and bandwidth for no present use, and deriving a mid-size public rendition later is a small deliberate step. The naming had to be settled now because ADR 0003 warns that filenames cannot change cheaply once shared, and nothing was shared yet; the thumbnail had been occupying the master's natural name. Rejected: quality-90 masters (every future derivative would start from an already compressed image), public full-size images, thumbnails only, archiving the raw `.unity3d` bundles instead (smallest effort, but reading them later depends on a decoder that has already proved fragile).
  Date/Author: 2026-09-21 / user (keep full-size images; chose private lossless masters), agent (layout, upload order, measurements).

- Decision (D36): The master is stored at the game's display shape, 2048 × 1152 (width kept, height resampled to 16:9 with a Lanczos filter, then encoded losslessly), not as the decoded 2048 × 1024 texture. This replaces the "deliberately not stretched" part of D35; everything else in D35 stands (private `master/` prefix, lossless webp, master uploaded before thumbnail). `upload.py` gained `--rendition {all,master,w192}` so that a change of one rendition's rule re-sends only that rendition (`uv run upload.py --assume-empty --rendition master`).
  Rationale: After the first upload on 2026-09-21 the user opened the masters and saw them "shrinked in vertical direction", while the thumbnails looked "just like how their ratio looks like in the game". The masters were not corrupted — the game stores every card texture squashed to a power-of-two 2:1 and stretches it when it shows the card, and D35 had kept the decoded pixels untouched on the agent's reasoning that the stretch is a display concern. That reasoning underweighted what a master is for: future use by someone or something that does not know the rule. A file that looks right only to a reader who knows "show this at 16:9" breaks this project's own principle that an artefact must not make its reader hunt for context, and the purity it bought was small, since the source texture is itself lossy (ASTC), so its decoded pixels were already an approximation. Cost: one high-quality 12.5 % vertical resample that cannot be undone exactly, and more storage (265 MB for 204 masters, against 219 MB). Rejected: keeping the decoded shape with a note beside it (the rule stays outside the file); keeping both shapes (about 485 MB and a second rendition to keep in sync, for pixels nobody has a use for).
  Date/Author: 2026-09-21 / user (chose the display shape after seeing the squashed masters), agent (diagnosis, resample and re-upload mechanics).

- Decision (D37): The Cache-Control stored with an uploaded object follows how that object is allowed to change. A master is overwritten whenever its rule changes (D36 did exactly that), so masters are uploaded with `private, no-cache` and must always be revalidated; a thumbnail never changes under its name, so thumbnails keep `public, max-age=31536000, immutable`. The rule is `cache_control_for(key, master_prefix)` in `scripts/images/uploads.py`, with a test. What the public site sends for a thumbnail is unaffected, because the Worker sets that header itself in `infra/worker/img.ts` and does not read the stored one. Replacing the header already stored on the 204 masters takes one more masters-only upload (`uv run upload.py --assume-empty --rendition master`).
  Rationale: See the Surprises entry of the same date: an immutable header on a file we expect to overwrite made a correct bucket look wrong and cost a debugging round. Rejected: storing no Cache-Control on masters (browsers then apply heuristic caching, which is unpredictable rather than absent); renaming masters on every rule change instead of overwriting (the file name is the game's own and is the point of ADR 0003).
  Date/Author: 2026-09-21 / agent proposed after the user's checksum test confirmed the cause; agreed by the user.

- Decision (D38): H.I.F. is the tracer bullet: the whole path — data update, counting, scoring, table, images, deployment, and later the unattended weekly update — is taken end to end for H.I.F. first, and 初LEGEND is left untouched until that path works. Concretely, `data/scenarios/hajime-legend.ts` keeps its provisional 標準 profile exactly as it is (its non-schedule counts and its lesson-split presets are the agent's guesses, marked as such in the file), no 初LEGEND route sheet is requested from the user for now, and work that restates profiles (the counting-model plan, `docs/plans/EXECPLAN_COUNTING_MODEL.md`) carries the 初LEGEND numbers over mechanically without improving them. This narrows D5, which shipped two scenarios in v1 as proof that scenarios are data: the second scenario stays in the code as that proof, but it is not being made trustworthy yet. The 初LEGEND route sheet listed as remaining under Milestone 2 is therefore deferred, not forgotten.
  Rationale: User, 2026-09-21: "初legend left untouched for now. We need to first make this tracer bullet for HIF." One scenario carried all the way through exposes the real problems of every layer — as Milestone 4 just did for images — whereas polishing a second scenario's numbers now would be spent on a model that the counting-model plan is about to restate.
  Date/Author: 2026-09-21 / user.

- Decision (D39): 初LEGEND is not published. `data/scenarios/index.ts` now exports two lists: `ALL_SCENARIOS` (H.I.F. and 初LEGEND — everything the engine can score, and what the real-data tests in `data/scenarios/scenarios.test.ts` keep covering) and `SCENARIOS` (H.I.F. only — what the page offers). The scenario selector is not rendered while only one scenario is published, a shared link naming `hajime-legend` falls back to H.I.F. through the existing tolerant URL parsing, and the production bundle contains no 初LEGEND data at all. To publish 初LEGEND later, add it to `SCENARIOS`; nothing else changes. This narrows D5 further than D38 did: the second scenario remains the proof that scenarios are data, but only in the code and the tests.
  Rationale: After D38 left 初LEGEND untouched, the agent pointed out that the live site was still offering it in the switcher with numbers resting on the agent's guessed counts, which contradicts `docs/adr/0005` (the site never shows a number it cannot stand behind). User, 2026-09-21: "Let's hide 初legend for now." Rejected: deleting the scenario (loses the working proof and the test coverage that a second scenario needs no code); showing it with a "provisional" label (a labelled guess is still a published guess, the same objection as the flagged zero of D33).
  Date/Author: 2026-09-21 / agent raised it, user decided.

- Decision (D40): `main` is production and `develop` is development. Feature branches start from `develop` and merge back into it with merge commits; a release is a merge of `develop` into `main`; every push to `main` that touches the page, the data or the Worker deploys through `.github/workflows/deploy.yml`, so merging into `main` is the deploy and nobody runs `wrangler deploy` by hand any more. The weekly data update is the one thing that enters `main` without passing through `develop`, and it merges `main` back into `develop` right afterwards (a conflict becomes a pull request, never a forced merge). No preview site for `develop` for now; it can be added later as a second Wrangler environment at a single-level name such as `gakumas-supportcards-dev.tia.run`.
  Rationale: Once `main` deploys by itself, unfinished work must have somewhere else to live, as the user pointed out. `main` as production matches the Git-flow rule in the user's global configuration and their other repositories, and it is decisive here for a GitHub reason: scheduled workflows run from the default branch only, so with `main` as production the weekly job's workflow file and the code it runs are the same version, and its data merges land directly on the branch that deploys. With a separate `prod` branch the schedule would run `main`'s workflow against `prod`'s code, or else promote whatever unfinished work sat on `main`.
  Date/Author: 2026-09-22 / user (asked for the separation, chose this model and "every push to main deploys"), agent (recommendation and reasons).

- Decision (D41): How the unattended update is put together, where it departs from what this plan first wrote. The gates run inside the update job, before the pull request exists, not as checks on the pull request: a pull request opened with GitHub's built-in token triggers no workflows, and neither does a merge made with it, which is also why the update workflow calls `deploy.yml` itself instead of relying on the push. The pull request is kept anyway, as the audit trail, and is merged at once with a merge commit; a repository rule that demands a review would make that merge fail, which leaves the pull request open for a person and is the intended fallback. Held cards do not hold the update back, because the page already hides them (ADR 0005): they open or refresh one issue labelled `held-cards` listing every reason, and the issue closes by itself on the first update that holds nothing. This is the first version of D34's "question to the user"; a drafted proposal with numbers, and the Discord button, belong to the separate approval service. Images for new cards are best effort — the run fetches the pinned extraction library, downloads only the bundles of released cards whose thumbnail the site lacks (`extract.py --only-missing`), and uploads master then thumbnail — and a failure there leaves a card showing its name and never blocks the data. Only three third-party actions are used (`actions/checkout`, `oven-sh/setup-bun`, `astral-sh/setup-uv`); pull requests, merges and issues go through the preinstalled `gh`. Because workflows cannot be run locally, their logic lives in tested scripts and `scripts/lib/workflows.test.ts` pins the properties that make them safe.
  Rationale: The acceptance this plan wrote for Milestone 5 ("the PR's checks include the test run") cannot hold with the built-in token, and using a personal token or an App just to get checks on a bot's pull request would add a long-lived credential for no extra safety, since the same gates already ran. Rejected: a second pull request carrying held cards (nothing can draft the proposal yet, and the hidden-card mechanism already keeps a wrong number off the site); third-party pull-request actions (more supply chain for what four `gh` commands do).
  Date/Author: 2026-09-22 / agent; the user chose "main always deploys" and "images in CI, never blocking".

- Decision (D42): The feedback endpoint (Milestone 6) follows the rehearsal-automation Worker's handler with three choices of its own. Rate limit: at most 5 issues per client per UTC day, counted in a KV namespace (`FEEDBACK_LIMITS`) under a truncated SHA-256 of IP, date and the secret `HASH_SALT`, counted only when GitHub accepted the issue, keys expiring after two days; without either secret the endpoint answers 503 and stores nothing. Context: every issue carries the page's query string, re-encoded by `URLSearchParams` and checked against a character pattern so it can be written into a Markdown link safely, and the build's commit; the form shows both before sending. Labels: `gakumas-supportcards` plus the category label (`bug`, `request`, `other`) shared with the rehearsal app's issues; the app label was created by hand, not left to the token. The GitHub credential is this app's own fine-grained token, Issues read and write on `tia-tools/feedback` only (the rehearsal repository's ADR 0015 rule).
  Rationale: A web endpoint can be posted to by anyone, and what needs bounding is daily volume into a repository one person reads. Cloudflare's rate-limit binding was compared and rejected as the only guard: its window is 10 or 60 seconds and its counters are per location, so it stops bursts but lets a slow script through (about 4 300 a day at 3 per minute); KV costs one namespace and one secret. Both key on IP, so neither stops rotating addresses; the issues-only token is what bounds that case. Attaching the view makes a "this number is wrong" report reproducible without asking back, and there is no way to ask back.
  Date/Author: 2026-09-23 / user (KV after the comparison, attaching the view, creating the label), agent (details).
  Review (2026-09-24, Codex second opinion before the first commit, verdict CHANGES REQUESTED). Accepted and fixed: the body cap compared characters, not bytes, and trusted `Content-Length` (a non-numeric one passed as `NaN`), so the body is now read as a byte-counted stream that stops at the cap (`readCapped`); a request without `CF-Connecting-IP` would have pooled into one shared quota and is now refused. Accepted as the known cost of the design, not changed: KV get-then-put is not atomic, so concurrent requests or requests at different locations can exceed 5 a day — this is the trade-off stated above, bounded by the issues-only token; only a Durable Object would make it exact. Put to the user, who chose to fix it: the message was inserted into the issue as Markdown, so an anonymous sender could write links, images and @mentions that appear under the token owner's name; it is now a fenced code block one backtick longer than any backtick run in the message (`fenced`), at the cost of long lines not wrapping in the issue view.
- Decision (D43): Every run of the weekly update, whatever its outcome, posts one message to the owner's private Discord channel through Nudge, the owner's own notification Worker at `https://nudge.tia.run` (source `github.com/Taka499/nudge`). The last step of the `update` job, "Tell Discord how it went", runs with `if: always()`, because a failed gate is the message that matters most; its title carries `job.status`, its body the update's title (or "No changes upstream; nothing published.") and the number of held cards. It calls the composite action `Taka499/nudge/actions/notify`, which requests a GitHub Actions OIDC token for the audience `https://nudge.tia.run`; so the workflow gains `id-token: write` and no secret is stored in this repository, and Nudge accepts only repositories owned by `Taka499` or `tia-tools`. This makes Nudge a fourth third-party action beside the three D41 lists. It is pinned to the full commit `2f92e97cceaa5f3d1cb9376e80ee5e8837a8268f` because Nudge has no `v1` tag yet and `uses:` accepts no short hash; it moves to `@v1` once Nudge's Milestone 1 is accepted. GitHub's failure mail stays as it is.
  Rationale: User, 2026-09-24: the update's outcome should be posted to the owner's private Discord channel, with the pinned commit and `if: always()` as stated above. It is a one-way notification only; D34's approve button still belongs to the separate approval service.
  Date/Author: 2026-09-24 / user (the step, the pin, `if: always()`), agent (wording, test update).

- Decision (D33): The site never shows a number it cannot stand behind. An effect the pipeline cannot score is never published as 0, flagged or not; a card carrying such an effect is hidden from the table until a person has confirmed how to count it, while every other card in the same update publishes normally. This rules out the "publish with a flagged zero" option the agent proposed on 2026-09-20 for making the weekly update unattended.
  Rationale: User: a flagged zero "will break the trustability of this tool". A missing card is an honest absence; a wrong or placeholder number is not.
  Date/Author: 2026-09-21 / user.

- Decision (D34): A data update that needs a human decision is a conditional pull-request approval, not a separate mechanism. The routine part of an update merges and deploys by itself; only when a defined condition is met (today: a genuinely new kind of event that no route profile can count) does the pipeline open a pull request carrying the proposal and ask the user to approve it. The request reaches the user as a push notification with an approve button that works in place, without opening another page; Discord is the first such interface. The approval service is expected to live in its own repository, because the same "notify, one tap, merge" contract applies to other automations — to be scaffolded separately, not inside this repository. Until that service exists, approving means merging the pull request on GitHub by hand, so Milestone 5 does not depend on it.
  Rationale: User, 2026-09-21: the confirmation "is more like a conditional PR confirmation request", Discord first, and an individual repository since it can serve future automation. A pull request keeps the proposal reviewable and the approval auditable in git; the button is only a remote control for its merge.
  Date/Author: 2026-09-21 / user (framing, channel, repository), agent (split between the self-merging routine part and the held proposal). Details of the approval service are not designed yet.


## Outcomes & Retrospective


Milestone 0 (2026-09-16): the join is proven end to end and the taxonomy approach holds, with one honest amendment — the game table alone covers 46 categories but not the five newest card triggers nor any P-item trigger, so a six-row audited extension list is needed (D13). The prototype also corrected three formula assumptions the design had made without data: per-skill activation caps (D15), unlimited-fire items (D16), and the own-event +50–100% multiplier that almost every card carries (D17). Lesson: reading every card's data, not two, is what surfaced all of these; the two sample cards alone showed none of them. Accepted 2026-09-17: the user verified both cards' level-60 values in game and accepted D13–D17 as proposed.


Milestone 4 (2026-09-21): the site is live at `https://gakumas-supportcards.tia.run` with real card art — 204 public 192 × 108 thumbnails and 204 private lossless 2048 × 1152 masters in R2. Compared with the plan, almost nothing about the image side survived contact with reality: the extraction library could not be a dependency, its converter was silently broken by a game engine upgrade, uploads go through Wrangler rather than the S3 API, the library stores two renditions rather than one, and unreleased art had to be held back. Three lessons. Probe before writing: every one of those facts came out of throwaway probes in the first hour, none out of documentation. A private file still has readers: the agent twice treated masters as if nobody would ever open one — first leaving them at the game's squashed storage shape, then stamping them with a year-long immutable cache header — and both times the user opening a file in the dashboard exposed it within minutes (D36, D37). And when a symptom appears in a browser, compare checksums outside the browser before touching the data: the bucket was correct the whole time.

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

Milestone 3, as executed on 2026-09-20 (inside the coding agent's sandbox `bun add` needs `BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache"`, and the dev server must run outside the sandbox because it cannot bind a port):

    bun add preact
    bun add -d vite @preact/preset-vite @tailwindcss/vite tailwindcss
    bun test                    # 95 pass (19 new in src/app/)
    bun run type-check
    bun run build               # dist/assets/index-*.js 1,728 kB │ gzip: 58 kB
    bun run dev                 # http://localhost:5173

Observed: every `src/app/*` module and `data/cards.generated.ts` served by the dev server with HTTP 200; Babel notes it "deoptimised the styling" of the 1.7 MB data file, which is harmless. Visual acceptance by the user the same day: sort, filters, hovers and URL reload pass; thumbnails await Milestone 4.

Milestone 4, as executed on 2026-09-20. From `scripts/images/` (setup of the pinned GkmasObjectManager checkout: `scripts/images/README.md` § Setup):

    uv sync
    uv run pytest                              # 12 passed
    uv run extract.py --only 'csprt-1-000[0-2]|csprt-2-0003|csprt-3-0016|csprt-3-0110'
    uv run extract.py                          # the rest
    uv run upload.py --dry-run --assume-empty

(The transcript below is from 2026-09-20, when only thumbnails were written to `out/webp`. Since D35 on 2026-09-21 the same commands write `out/master` and `out/w192`: `converted 204 of 204 into …/out/master and …/out/w192`, then `0 already served, 204 missing` followed by 408 `would upload` lines alternating `master/…` and `w192/…`.)

Observed:

    manifest 205100:0061: 6 image(s) to process
    converted 6 of 6 into .../scripts/images/out/webp
    manifest 205100:0061: 198 image(s) to process
    converted 198 of 198 into .../scripts/images/out/webp        # 15 s wall clock; out/webp 1.3 MB, out/raw 126 MB
    holding back 2 image(s) whose card is not in the data yet: img_general_csprt-2-0080_full.webp, img_general_csprt-3-0109_full.webp
    0 already served, 202 missing

From the repository root and `infra/worker/`:

    bun test                                   # 102 pass (7 in infra/worker/img.test.ts)
    bun run build
    cd infra/worker && bunx wrangler deploy --dry-run --outdir /tmp/wrangler-out

Observed:

    Read 4 files from the assets directory .../dist
    Total Upload: 1.87 KiB / gzip: 0.81 KiB
    env.IMAGES (tia-assets)      R2 Bucket
    env.ASSETS                   Assets
    --dry-run: exiting now.

Still to run, by the user, with the Cloudflare account that holds `tia.run` (`infra/worker/README.md` § One-time account setup, § Deploy):

    bunx wrangler login
    bunx wrangler r2 bucket create tia-assets
    bun run build && (cd infra/worker && bunx wrangler deploy)
    (cd scripts/images && uv run upload.py --assume-empty)

Inside the coding agent's sandbox three of these needed workarounds that a normal shell does not (see Surprises): `uv sync` and the dev server run outside the sandbox, sandboxed Python HTTPS needs `REQUESTS_CA_BUNDLE`/`SSL_CERT_FILE` set to a CA bundle not named `*.pem`, and `bunx wrangler` fails there while `npx --yes wrangler@4` with `npm_config_cache="$TMPDIR/npm-cache"` works.

Milestone 6, as executed so far on 2026-09-23:

    gh label create gakumas-supportcards --repo tia-tools/feedback --description "In-app feedback from gakumas-supportcards.tia.run"
    bun test                                   # 186 pass (11 in infra/worker/feedback.test.ts, 5 in src/app/feedback.test.ts)
    bun run type-check
    bun run build                              # dist/assets/index-*.js 1,351 kB │ gzip: 57 kB
    cd infra/worker && npx --yes wrangler@4 deploy --dry-run --outdir "$TMPDIR/wrangler-out"

Observed from the dry run:

    env.FEEDBACK_LIMITS (9837b184f0a343b78db446d26690aa3a)      KV Namespace   # after the user created the namespace on 2026-09-24
    env.IMAGES (tia-assets)                                 R2 Bucket
    env.ASSETS                                              Assets

Run by the user on 2026-09-24 from `infra/worker/` (from the repository root Wrangler fails with "Required Worker name missing"): `bunx wrangler secret put FEEDBACK_TOKEN`, `openssl rand -hex 32 | bunx wrangler secret put HASH_SALT`; `bunx wrangler secret list` then names both.

Exact commands and transcripts must be updated here as each milestone is executed.


## Validation and Acceptance


Milestone 0 is accepted when the prototype prints zero unclassified effects over all cards and the two sample cards' values at level 60 equal the in-game display (the user checks in game or against hatsuboshi-library's card page). Status 2026-09-17: accepted — zero unclassified pairs (transcript above) and the user confirmed both cards' level-60 values in game.

Milestone 1 is accepted when `bun run generate` is idempotent (second run produces no diff), `bun test` passes, and deliberately corrupting the taxonomy file (delete one row) makes the generator exit non-zero naming the orphaned effect.

Milestone 2 is accepted when `score()` for a card with only an SP発生率 skill returns 0 in every 凸, a card with only P-point skills returns 0 with `parts` empty, and the golden cards match the numbers the user confirmed; and when switching the scenario argument from `hif` to `hajimeLegend` changes the totals without any code change.

Milestone 3 is accepted when the page at `http://localhost:5173` shows all cards, sorts by each 凸 column, filters by type/plan/rarity, shows the name on thumbnail hover, shows the breakdown on number hover, and reloading a URL with query parameters restores the same view.

Milestone 4 (status 2026-09-21: accepted — deployed by the user, checks in Progress) is accepted when `https://gakumas-supportcards.tia.run/` serves the page and `https://gakumas-supportcards.tia.run/img/w192/img_general_csprt-3-0016_full.webp` returns HTTP 200 with `content-type: image/webp` and an immutable cache header, while `https://gakumas-supportcards.tia.run/img/master/img_general_csprt-3-0016_full.webp` returns 404 although that object is in the bucket (D35).

Milestone 5 is accepted when a manual run of "Update data" on `main` either ends with "No changes upstream; nothing to publish." or produces a merged pull request touching only `data/`, whose text lists the new and changed cards, followed by a green "Deploy" job and the new data live on the site; and when a push to `main` that touches the page deploys by itself. (Amended 2026-09-22 by D41: the gates run in the update job before the pull request is opened, because a pull request opened with the built-in token gets no checks.) To see the changed path without waiting for the game: run the workflow from a branch whose committed data is one upstream update behind.

Milestone 6 (status 2026-09-24: accepted — issue #8, see Progress) is accepted when submitting the form creates an issue in `tia-tools/feedback` labelled `gakumas-supportcards`.


## Idempotence and Recovery


Generators overwrite their outputs wholesale and are safe to rerun; `git diff data/` is the review surface. The extract script skips thumbnails that already exist, and the upload script asks the deployed site which images are missing (D30) and uploads only those, so a failed run of either is resumed by rerunning. `wrangler deploy` is idempotent. Nothing in this plan writes to the sibling repository.


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

UI modules (Milestone 3, `src/app/`): `url-state.ts` exports `ViewState` (`scenarioId`, `profileId`, `split: number | null`, `types`, `plans`, `rarities`, `sort: { totsu, desc }`, `overrides: Record<categoryId, number>`), `parseViewState(params, scenarios, taxonomy)`, `serializeViewState(state, scenarios)`, `resolveSelection`, `shortCategoryKey`, `categoryKeyMap`; `rows.ts` exports `Row` (`card`, `scores` at 凸0–凸4, `noParameterEffect`), `applyOverrides`, `buildRows(cards, ctx, split)`, `filterRows`, `sortRows`, `formatPoints`. Both are pure and unit-tested; the components (`App`, `Controls`, `ScoreTable`, `Breakdown`, `CustomizePanel`) and the `useUrlState` hook only render or sync what they return. `images.ts` builds thumbnail URLs as `/img/img_general_{assetId}_full.webp` (ADR 0003).

Feedback (Milestone 6, D42). `infra/worker/feedback-contract.ts`: `FEEDBACK_CATEGORIES` (`bug`/`request`/`other` → バグ/要望/その他), `FEEDBACK_MESSAGE_MAX` (4000), `FEEDBACK_VIEW_PATTERN`, `FEEDBACK_COMMIT_PATTERN`, `FeedbackPayload` `{category, message, view, commit}`. `infra/worker/feedback.ts`: `parsePayload(raw) -> FeedbackPayload | null`, `composeIssue(payload) -> NewIssue`, `dailyBucket(ip, day, salt)`, `handleFeedback(request, deps)` with `FeedbackDeps` `{store: CountStore, salt, token, createIssue, now}`, `createGitHubIssue`. `src/app/feedback.ts`: `viewToAttach(search)`, `buildPayload(category, message, search, commit)`, `resultText(status)`; `FeedbackForm.tsx` renders them.

Image pipeline (Milestone 4). `scripts/images/thumbnail.py`: `OBJECT_PATTERN`, `MASTER_PREFIX` (`master/`), `THUMBNAIL_PREFIX` (`w192/`), `file_name_for(object_name) -> str | None` (`img_general_csprt-3-0016_full.unity3d` → `img_general_csprt-3-0016_full.webp`), `display_size(size)` (width kept, height at 16:9), `to_master(image) -> bytes` (lossless, at the display shape 2048 × 1152 per D36), `to_thumbnail(image) -> bytes`. `decode.py`: `UNITY_VERSIONS`, `is_plausible(width, height)`, `decode_texture(raw, versions, load) -> Image` raising `DecodeError` that names every attempt; `load(raw, version)` is injectable, so the rule is tested without UnityPy or a real bundle. `uploads.py`: `plan_uploads(keys, exists) -> UploadPlan(missing, present)`, `card_keys(cards_source) -> set[str]`, `publishable(keys, allowed) -> (keep, held)`, `upload_order(file_name, master_prefix, thumbnail_prefix) -> [master key, thumbnail key]` (D35), `select_renditions(keys, rendition, …)` behind `upload.py --rendition` (D36). `extract.py` and `upload.py` are the only files doing I/O. `infra/worker/img.ts`: `imageKey(pathname) -> string | null` (matches only `/img/w192/img_general_csprt-N-NNNN_full.webp` and returns the bucket key `w192/…`; `master/` never matches), `serveImage(request, bucket) -> Response` over an `ImageBucket` (`head`, `get`) that is the slice of R2's API the handler uses, so tests pass a fake and the Workers type package is not needed; `worker.ts` routes `/img/*` to it and everything else to `env.ASSETS`. `vite.config.ts` reuses `imageKey` in a dev-only plugin that serves `scripts/images/out/w192`.

`score` sums, over resolved effects, with `count(categoryId)` = `profile.counts[categoryId]`, falling back to `profile.counts[countsAs]` for an extension row that names one, else 0, and `occurrences = cap ? min(cap, count) : count`: for `kind === "skill"` with the パラメータボーナス+ category, `value/1000 × profile.parameterBonusBase[stat]`; for other skills, `value × occurrences` (D15); for events, `value × (1 + breakpoint.eventBonusPermil/1000)` (D17); for items, `value × occurrences` (D16). Categories the profile does not name count 0; the generator's taxonomy test asserts every category id in every shipped profile exists in the taxonomy, so a typo fails the build. (Formulas as amended by decisions D13–D17, accepted 2026-09-17.)

Open question carried to Milestone 2: whether 初LEGEND Legend lessons should be treated as SP lessons for trigger purposes (they are a distinct lesson kind in that scenario). Resolve with the user before writing `hajime-legend.ts`; record the answer in the Decision Log. A second open question from Milestone 0: the dump gives 初LEGEND's `idolCardParameterGrowthLimit` as 3000, not the 2800 stated in Context and Orientation; confirm which the game shows today before writing `hajime-legend.ts`.


## Revision notes


- 2026-09-16 (Milestone 0 executed): Progress, Surprises & Discoveries, Decision Log (D13–D17, proposed), Outcomes & Retrospective, Context (P-item join path), Concrete Steps (actual commands and transcript), Validation (status) and Interfaces (`cap`, `eventBonusPermil`, amended `score` formula) updated to reflect what the prototype found. Reason: the design's formulas for skills, items and events were written before any data was read; the data showed per-skill caps, unlimited-fire items, an own-event multiplier and gaps in the game's filter table, and the plan must carry those so Milestone 1 does not re-discover them.
- 2026-09-17 (Milestone 0 accepted): the user verified both sample cards in game and accepted D13–D17; Progress, Decision Log, Outcomes, Validation and Interfaces stamped accordingly; ADR 0002 received an addendum and the `CLAUDE.md` index line for it was updated.
- 2026-09-17 (Milestone 1 executed): Progress, Concrete Steps (commands, transcript, acceptance evidence) and Surprises (redundancy-guard rule, generated file size) updated; the prototype script was removed as planned. Reason: the plan must show the generators' real behaviour and guards so Milestone 2 can build on the committed data without rereading the code.
- 2026-09-17 (Milestone 2 engine built, profiles pending): Progress split into completed/remaining, Concrete Steps and Interfaces updated to the implemented signatures (`ScoreContext`, explicit `limits`, `lines` on `Score`). Reason: the engine's real interface differs from the sketch (dependencies passed in for testability), and the next session must know that H.I.F. counts and three answers are still owed by the user before golden tests can exist.
- 2026-09-19 (H.I.F. profiles landed): Surprises gained the H.I.F. structure and the 初LEGEND lesson correction; Decision Log D18–D24; Progress and Interfaces (`parameterBonusBase`) updated. Reason: the first route sheet asked the user for numbers the schedule fixes and rested on a wrong 初LEGEND model; the plan now carries the researched schedules and the user's actual route choices so the profiles can be re-derived rather than trusted.
- 2026-09-20 (D27 confirmed, M0–M2 merged): D27 stamped as confirmed; the fail-loud generalisation of the generators (unknown effect types, item effect types, event reward resources, skills granting P-items) committed on `feature/m2-engine`, then the M0→M2 stack merged into `main` in order with merge commits. Reason: Milestone 3 branches from `main`, so the engine and data it builds on must be on the default branch first.
- 2026-09-20 (Milestone 3 started): Progress (M3 status, what is and is not verified), Decision Log (D28 bundle encoding, override semantics), Concrete Steps (M3 commands and observations) and Interfaces (UI modules) updated. Reason: the next session or the user must know that the page is built and served but its visual acceptance is still owed, and why the data stays inline.
- 2026-09-20 (M3 accepted visually; ESLint deferred): Progress (visual acceptance result, ESLint outcome), Surprises (TypeScript 7 has no compiler API), Decision Log (D29) updated. Reason: the next session must not repeat the ESLint attempt on TypeScript 7, and must know which gates are and are not enforced.
- 2026-09-20 (Milestone 4 built up to deployment): Progress, Surprises (GkmasObjectManager is not a package; object names and hosts; its converter is broken by a stale Unity version and fails silently; 2:1 storage and thumbnail sizes; sandbox limits), Decision Log (D30 upload path, D31 own decoding, D32 released cards only), Concrete Steps (commands, transcripts, the steps left to the user), Validation, Idempotence and Interfaces updated. Reason: the plan described an extraction library that could be imported as a dependency and would convert images itself; neither held, and the next session must know what was built instead and that only the account-bound steps remain.
- 2026-09-20 (data update): Progress gained the manual data update entry and Surprises the note on what retiring an extension row involves. Reason: this was the first time the retirement guard fired on live data, and Milestone 5's automation will meet the same situation — a weekly run that stops on this guard needs a person to delete the row and update the profiles, which the workflow's PR text should say.
- 2026-09-21 (automation direction): Decision Log gained D33 (no unscored number is ever published; affected cards are hidden) and D34 (human decisions arrive as conditional pull-request approvals, Discord first, service in its own repository). Reason: the user reviewed whether updates can run unattended; these are the parts settled so far. The counting-model redesign discussed alongside them (events, filters and conditions instead of one count per filter-table row) is still under discussion and deliberately not recorded as a decision yet.
- 2026-09-21 (masters): D32 and D31 stamped confirmed; Decision Log gained D35 (private lossless masters beside public thumbnails, prefixes `master/` and `w192/`, master uploaded first); Progress, Concrete Steps and Interfaces updated to the new layout. Reason: the user asked whether only 192 × 108 images would be stored and chose to keep full-size originals; the naming had to change before the first deployment made it permanent.
- 2026-09-21 (master shape): Decision Log gained D36 (masters at the 16:9 display shape), Progress records the deployment, its outside verification and the master re-encode, Interfaces lists `display_size` and `select_renditions`. Reason: the user saw squashed masters after the first upload; the agent's "untouched pixels" choice in D35 made the files depend on a rule stored elsewhere, which the user rejected.
- 2026-09-21 (master cache header): Surprises gained the stored Cache-Control observation with its checksum evidence, Decision Log D37, Progress the outcome of the masters re-upload. Reason: a correct bucket looked wrong to the user because of a header the agent had set, and the agent had earlier stated the opposite; the plan must carry both the fact and the correction.
- 2026-09-21 (Milestone 4 complete): Progress ticked with the acceptance evidence, Validation stamped, Outcomes & Retrospective gained the Milestone 4 entry. Reason: the user finished the last upload and the live checks pass.
- 2026-09-21 (H.I.F. first): Decision Log gained D38 and the Milestone 2 remaining list now marks the 初LEGEND route sheet as deferred. Reason: the user decided to take H.I.F. through the whole path as a tracer bullet before touching 初LEGEND.
- 2026-09-21 (初LEGEND unpublished): Decision Log gained D39. Reason: D38 left 初LEGEND untouched, which also left its guessed numbers on the live site; the user chose to hide it until it has a real route sheet.
- 2026-09-22 (Milestone 5 started): Progress, Decision Log (D40 branch model and automatic deploys, D41 shape of the unattended update) and the Milestone 5 acceptance updated. Reason: the counting model landed and unblocked the automation; two GitHub facts (no workflows triggered by the built-in token's pull requests and merges; schedules run from the default branch only) changed what the plan had written.
- 2026-09-22 (token permissions): Surprises gained the Cloudflare permission-model change; `infra/worker/README.md` § Deploy now specifies the account-owned token with Editor on this one Worker, Workers Routes on `tia.run` and Workers R2 Storage. Reason: the user noticed "Workers Scripts" is marked legacy and the advice had to be verified against the week-old model rather than restated.
- 2026-09-22 (Milestone 5 accepted): Progress ticked with the token, the release, the first automatic deploy and the first manual update run. Reason: both workflows have now run on GitHub; only the pull-request path awaits a real upstream change.
- 2026-09-23 (Milestone 6 built): Progress, Decision Log (D42 rate limit, attached view, labels), Concrete Steps and Interfaces updated. Reason: the endpoint and form are built and tested locally, and the next step is the user's account setup (KV namespace, token, salt). 2026-09-24: namespace created and its id filled in.
- 2026-09-24 (Milestone 6 accepted): Progress ticked with the release, the outside checks and issue #8; Validation stamped. Reason: the first real submission created the labelled issue, and its content is the first user request of the page.
- 2026-09-24 (update outcome to Discord): Decision Log gained D43 (the weekly update posts its outcome to Discord through Nudge; `id-token: write`; a fourth, commit-pinned action). Reason: the user asked for the update's outcome in their private Discord channel; the change is to `.github/workflows/update-data.yml` and `scripts/lib/workflows.test.ts`, and is accepted when a manual "Update data" run shows the "Tell Discord how it went" step green.
- 2026-09-24 (Nudge v1.0.0, Dependabot): the notify step moved from the commit D43 recorded to `Taka499/nudge/actions/notify@b706447babea35d3b95dcdbae7ec03f007cb2b2a # v1.0.0`, the commit Nudge's `v1.0.0` tag points to; it stays pinned to a full hash rather than the movable `v1` tag, and `.github/dependabot.yml` (GitHub Actions, weekly, pull requests into `develop`) proposes each new release as a pull request that changes the hash and its version comment. Reason: the user asked for the release pin and for Dependabot, as Nudge itself does; a moved tag would otherwise change code that runs with this workflow's write permissions without a review. A Dependabot pull request must also update `ALLOWED_ACTIONS` in `scripts/lib/workflows.test.ts`, or the next update's unit-test gate stops that update.
