# Publish the skill card data, icons and sprite sheets that gkms-memomemo reads

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. It is maintained in accordance with `docs/PLANS.md` at the repository root.

The work is tracked on the project's board (tia-tools project 8) as issue #65, claimed by the branch `issue/65-publish-skillcards-v1-json-the-skill-car`.

## Purpose / Big Picture

「学マス　メモリーメモ帳」 (`https://gkms-memomemo.tia.run`, repository `tia-tools/gkms-memomemo`) is a sibling page where a 学園アイドルマスター player keeps a memo of the produce memories they own. Every row of that memo names a skill card, and the page draws each card with its icon. That page has no game data of its own: by its decisions D21, D22 and D42 it reads the skill card data and the icons from this repository at runtime, as `tia-tools/gmks-hif-final-stats` already reads `/data/cards.v1.json` (`docs/adr/0010`). Its data contract and every later milestone are blocked until this plan publishes three things:

1. A data file at `https://gakumas-supportcards.tia.run/data/skillcards.v1.json`, listing the playable idols, every skill card that can be a produce memory (its pool), and the H.I.F. memory abilities with the card each belongs to.
2. The icon of every pool card in every idol's variant, stored in the shared R2 bucket `tia-assets` as a private lossless master and a public 112-pixel rendition.
3. Sprite sheets built from those icons, one per training plan and playable idol (39 today), and an index naming each sheet's cells, so that a player's browser loads a handful of images instead of hundreds.

After this plan, these commands answer from the live site:

    curl -s https://gakumas-supportcards.tia.run/data/skillcards.v1.json | head -c 300
    # {"formatVersion":1,"idols":[{"id":"hski","name":"花海咲季"}, …
    curl -s https://gakumas-supportcards.tia.run/img/sheet112/index.v1.json
    # {"formatVersion":1,"cell":112,"sheets":[ … 39 entries … ]}
    curl -sI https://gakumas-supportcards.tia.run/img/sheet112/sense-hski-<8 hex digits>.webp
    # HTTP/2 200

and the daily data update keeps all three current when the game releases a card.

The requirements come from gkms-memomemo's plan, `docs/plans/EXECPLAN_MEMORY_MEMO.md` § Interfaces and Dependencies § What gakumas-supportcards must provide (Milestone 1), on its `develop` branch. This plan restates everything needed from it, so it can be followed without that document.

## Progress

- [x] (2026-10-31 11:30Z) Issue #65 read with gkms-memomemo's requirements; this repository's generator, build plugin, image pipeline, Worker and workflows read; the approach confirmed by the user with decisions K1–K3; #65 claimed on the board; the branch reset onto `develop` (it had been cut from `main`).
- [x] (2026-10-31 11:45Z) The upstream tables (`vertesan/gakumasu-diff` at `fc6afb8b5ba4`, still its head) and five icon bundles from manifest `205100:0075` read in a scratch directory; every count in the requirements reproduced (Surprises & Discoveries).
- [x] (2026-10-31 11:50Z) This plan written.
- [x] (2026-10-31 11:55Z) Milestone 1, code: the seven tables declared in `scripts/lib/tables.ts`; the contract `data/skillcard-data-file.ts`; the builder `scripts/lib/build-skillcards.ts` with 17 tests, each of its 28 rules seen to turn a test red when broken; the emitter, `bun run generate` writing `data/skillcards.generated.ts` (13 idols, 181 + 180 cards, 115 abilities; a second run byte-identical; no support card file changed); the build plugin writing `dist/data/skillcards.v1.json` (192,178 bytes, 13,823 gzipped) with its tests, each seen to fail with its rule broken. `bun test` (354 pass), `bun run type-check`, `bun run lint`, `bun scripts/check-score-stability.ts` (0 unexplained moves) and `bun run build` exit 0. Commits `43006a1`, `fa5aa26`, `1684a89`.
- [x] (2026-10-31 11:58Z) Milestone 1, docs: ADR 0010 addendum, `CLAUDE.md`, the header of `update-data.yml`.
- [x] (2026-10-31 12:03Z) Milestone 1, Codex review (codex-cli 0.150.1, read-only, in a snapshot; the repository was not written): CHANGES REQUESTED with five findings; two fixed (K15 typed loading, K16 duplicate rows and the sort), one fixed in tests only and two declined (K8, K17), each new test seen to fail with its rule broken; the real tables load and the module is unchanged.
- [x] (2026-10-31 12:06Z) Milestone 1, second Codex run over the fixes: CHANGES REQUESTED with one finding, both fixes judged correct and both declined findings defensible. The finding: `scripts/generate-cards.ts` built the score snapshot and the new texts after its first writes, so a throw there would have left files half replaced (the snapshot's place predates this plan). Fixed: every text is made before the first write; regeneration gives identical files.
- [x] (2026-10-31 12:32Z) Milestone 1, a third Codex run over `1a36cf9`: **CODEX VERDICT: LGTM**. Every gate passed on a clean clone of `1a36cf9` (361 tests; the page bundle holds no skill card data). With the user's go, `1a36cf9` was pushed alone and pull request #66 opened into `develop`; its `check.yml` run passed.
- [ ] Milestone 1, remaining: the user's merge of #66 and release to `main`, and the live `curl`.
- [x] (2026-10-31 12:32Z) Milestone 2: `infra/worker/img.ts` matches one pattern per rendition and also answers `w112/` skill card icons (single and per idol), `sheet112/<plan>-<idol>-<8 hex>.webp` (immutable webp) and `sheet112/index.v1.json` (`application/json`, `no-cache`, K14); the dev server takes the content type from the same rule; five new tests, each rule seen to fail when broken; committed locally as `fd6ffbb`, kept out of #66. The dev-server check waits for the local icons of Milestone 3.
- [x] (2026-10-31 12:48Z) Milestone 3, locally: `skillcards.py` reads the generated module; `thumbnail.py` names skill card icons and makes their lossless master and 112-pixel icon; `extract.py` and `upload.py` handle them, published only for the pool, planned from the stored sheet index first (K12); the upload command moved into `r2.py`. `uv run extract.py --only 'skillcard'` converted all 2,226 offered icons in about seven minutes (Surprises & Discoveries), every one of the 1,693 pool icons among them; `uv run upload.py --dry-run --assume-empty` plans 1,693 masters and 1,693 `w112/` icons, master first, holding back 533. The dev server answers `/img/w112/…`, a sheet and the index with their content types. Commits `cff3726`, `2d96629`.
- [x] (2026-10-31 12:48Z) Milestone 4, locally: `sheet_rules.py` (layout, staleness, content name, index) and `sheets.py` (build stale sheets from the masters, check their icons are stored, upload sheets, then the index); `extract.py --only-missing` also fetches the icons of stale sheets (K13); the daily image step runs `uv run sheets.py` after `upload.py`, pinned by `scripts/lib/workflows.test.ts`. `uv run sheets.py --dry-run` built 39 sheets (68, 68 and 65 icons) of 118–124 KB at quality 80 and the index; quality chosen by measurement (K18). 46 Python tests, every new rule seen to fail when broken. Commits `dd0fd4a`, `2d96629`, `5a3dded`.
- [ ] Milestones 2–4, remaining: docs (images and Worker READMEs, `CLAUDE.md`), `/codex-review` of the branch after #66 merges, and the second pull request.
- [ ] Milestone 5: release and first publication — pull request into `develop`, release, the first bulk upload with the user's go, the acceptance checks, ADR 0003 addendum, close-out.

## Surprises & Discoveries

- Observation: every number in gkms-memomemo's requirements holds on today's tables. The pool is 181 cards at level 0 and 180 at level 1 (表現の基本 has no level 1 in the pool); at level 0, 58 センス (`ProducePlanType_Plan1`), 58 ロジック (`Plan2`), 55 アノマリー (`Plan3`) and 10 free (`Common`); 78 SR, 51 R, 45 SSR and 7 N. 126 of the 181 have per-idol art (`isCharacterAsset: true`) and 55 a single image, so with 13 playable idols there are 126 × 13 + 55 = 1,693 icons. A sense or logic sheet holds 68 cells and an anomaly sheet 65 (the plan's cards plus the 10 free ones). There are 115 H.I.F. abilities, each with one `ProduceSkill` row whose only effect id names a distinct card, all 115 of them pool cards at level 0. No `ProduceCard` row has a `viewStartTime` in the future today.
  Evidence: a scratch script over the eight tables, 2026-10-31 (`$TMPDIR/skc/scripts/explore.ts`, not kept):

      pool L0 181 L1 180
      perIdol ids 126 single 55
      hif abilities 115 … hif bad 0 … hif cards distinct 115 in pool L0 115
      playable hski:花海咲季:10 ttmr:月村手毬:20 fktn:藤田ことね:30 atbm:雨夜燕:35 amao:有村麻央:40 kllj:葛城リーリヤ:50 kcna:倉本千奈:60 ssmk:紫雲清夏:70 shro:篠澤広:80 jsna:十王星南:90 hmsz:秦谷美鈴:95 hume:花海佑芽:100 hrnm:姫崎莉波:120
      icons 1693
      ProducePlanType_Plan1 cells per sheet 68 / Plan2 68 / Plan3 65

- Observation: a skill card icon texture is 256 × 256 RGBA with real transparency (rounded corners), so the 112-pixel rendition keeps its planned prefix `w112/`, and the sprite sheets must be WebP with alpha.
  Evidence: five bundles decoded with this repository's `scripts/images/decode.py` from manifest `205100:0075` (2,290 `img_general_skillcard_*` assets listed):

      img_general_skillcard_act-1_001.unity3d 10222 bytes (256, 256) RGBA alpha (0, 255)
      img_general_skillcard_act-2_009-hski.unity3d 14035 bytes (256, 256) RGBA alpha (0, 255)
      img_general_skillcard_act-3_029-hski.unity3d 17895 bytes (256, 256) RGBA alpha (0, 255)
      img_general_skillcard_ido-100_039.unity3d 30120 bytes (256, 256) RGBA alpha (0, 255)
      img_general_skillcard_men-0_003.unity3d 7608 bytes (256, 256) RGBA alpha (0, 255)

- Observation: two customization labels carry the game's escaped line break, the two characters backslash and `n`, inside the text: `パラメータ\n上昇回数+` (the `produceCardCustomizeDescription` of one grow-effect type) and `レッスン中1回\nの制限削除` (the `description` of three customization rows). No card name and no guide label has one. Decision K6 turns the escape into a real line break.
  Evidence: `grep -F` in the raw YAML: `produceCardCustomizeDescription: "パラメータ\\n上昇回数+"`, `description: "レッスン中1回\\nの制限削除"`.

- Observation: a customization row has a field `overwriteProduceCardGrowEffectType` that is not in the requirements. On the pool's rows it is set only where `description` is also set (for example `好調追加` with overwrite `ParameterBuffTurnAdd`, whose generic label is `好調+`), so the requirements' rule never consults it today; the rows with an empty description and an overwrite all belong to P-idol unique cards outside the pool. Decision K6 makes the generator stop if a pool row ever has an empty description and an overwrite whose label differs from the first grow effect's.
  Evidence: a scratch script printing every row whose overwrite is not `ProduceCardGrowEffectType_Unknown`, 2026-10-31; for example `p_card_custom-p_card-03-ido-3_083-1 1 "" | overwrite: CardStatusEnchantChange "成長変更"` (not in the pool).

- Observation: `ProduceCard.order` is a 14-digit string, unique among pool cards and identical between levels of one id, so sorting the strings gives the game's order; `assetId` is also identical between levels. All pool asset ids have the form `img_general_skillcard_(act|men)-<digits>_<three digits>`.
  Evidence: `order lengths [ 14 ]`, `orders unique 181 of 181`, `order differs between levels 0`, `asset differs between levels 0`, `asset name shapes img_general_skillcard_act-#_# 94, img_general_skillcard_men-#_# 87`.

- Observation: the 39 sprite sheets are far below the half-megabyte target at every quality tried, so quality 80, the one the other renditions use, costs nothing (K18). At 2× magnification quality 80 shows no visible blocking.
  Evidence: all 39 sheets composed from the local masters (`$TMPDIR/skc/scripts/measure.py`, not kept), 2026-10-31:

      quality 90: min 170,596 max 181,024 mean 175,811 total 6,856,654 bytes
      quality 80: min 116,718 max 123,916 mean 120,187 total 4,687,324 bytes
      quality 70: min  92,404 max  98,776 mean  95,685 total 3,731,742 bytes
      quality 60: min  82,712 max  88,482 mean  85,602 total 3,338,512 bytes
      quality 50: min  74,128 max  79,264 mean  76,672 total 2,990,208 bytes

- Observation: the manifest offers 2,226 skill card icons that match the library's naming (2,290 `img_general_skillcard_*` assets in all; the other 64 are 59 support-card event cards' `sup-` icons, the trouble card's `acc-` and four `ido-…_mid-<idol>-…` variants, none of which can be in the pool); 1,693 are the pool's and 533 are held back on upload (unreleased cards, P-idol unique and event cards, Legend cards, and the variants of 根緒亜紗里, who is not playable). A full local extraction took about seven minutes and wrote 9.2 MB of `w112/` icons (about 4 KB each) and 81 MB of masters. The vendored GkmasObjectManager's dependency `pydub` prints `SyntaxWarning: invalid escape sequence` for its own regular expressions on every run; it does not affect decoding.
  Evidence: `uv run extract.py --only 'skillcard'` from 12:29:47Z to 12:36:52Z, `converted 2226 of 2226`; `du -sh out/w112` 9.2M; `uv run upload.py --dry-run --assume-empty`: `holding back 533 image(s)`, `0 already served, 1693 missing`.

- Observation: the dev server answers a request for `/img/master/…` with 200 `text/html`. That is Vite's page fallback for a path no middleware takes, not the master: `localImageLibrary` passes such a path on, as it always has for `w192` masters.
  Evidence: `curl` against `bun run dev --port 5199`: `master/img_general_skillcard_act-3_029-hski.webp -> 200 text/html`.

## Decision Log

- Decision: K1 — the data file goes out first. Milestone 1 ends with its own pull request into `develop` and a release to `main`, so gkms-memomemo can start its data contract (its issue #4) while the images are built; Milestones 2–5 continue on the same branch and end in a second pull request, whose merge closes #65.
  Rationale: the data contract needs only the file; the page milestones that need images come later.
  Date/Author: 2026-10-31, user.

- Decision: K2 — the skill card data is generated inside `bun run generate`, and anything it finds broken upstream stops the whole run: nothing is written, the daily update fails and its Discord message says so, and support card updates wait until a person fixes it.
  Rationale: the same rule as the existing "the dump itself looks broken" checks (`scripts/generate-cards.ts`); a second path that publishes support cards while skill cards are stuck would add moving parts to the generator and the workflow for a rare event.
  Date/Author: 2026-10-31, user.

- Decision: K3 — the branch was reset onto `origin/develop` before its first commit; it had been created from `main`, which lacks the task-board merge.
  Rationale: the project branches features from `develop` (`CLAUDE.md` § Commit Discipline).
  Date/Author: 2026-10-31, user (the reset itself was run by the user, a permission rule having refused it to the agent).

- Decision: K4 — release is decided when `bun run generate` runs, with the clock passed in as an argument: a card is in the pool when its `viewStartTime` is `"0"` or not later than that moment. The committed module is then exactly what the build publishes and what the image pipeline is allowed to publish art for.
  Rationale: one place decides release, so data and art cannot disagree; the game releases at 11:00 JST (`viewStartTime` `1778896800000` is 2026-05-16 02:00 UTC) and the daily update runs at 11:30 and 20:30 JST, so a released card appears the same day. Filtering again at build time would only matter for a deploy between a release and the next update, and would let the file and the images disagree.
  Date/Author: 2026-10-31, agent.

- Decision: K5 — the file's types live, self-contained (no imports), in `data/skillcard-data-file.ts`, with their own `SKILLCARD_DATA_FORMAT_VERSION = 1`, separate from `CARD_DATA_FORMAT_VERSION`. gkms-memomemo copies that one file's types verbatim. Any change to the shape bumps the version and the file name, as `docs/adr/0010` requires of `cards.v1.json`.
  Rationale: the two files have different consumers and change for different reasons; a self-contained module is one copy for the consumer, and the engine types of `src/engine/types.ts` stay out of this contract.
  Date/Author: 2026-10-31, agent.

- Decision: K6 — a customization step's `label` is its `description` when that is not empty, else the `produceCardCustomizeDescription` of its first grow effect's `effectType`, as the requirements say, with two additions. The game's escape `\n` (backslash, `n`) in a label becomes a real line break. And the generator stops, naming the row, when a pool row has an empty `description` and an `overwriteProduceCardGrowEffectType` other than `ProduceCardGrowEffectType_Unknown` whose label differs from the first grow effect's, because the two candidate labels would then disagree and nothing says which the game shows.
  Rationale: the escape is how the game marks a line break, and publishing it as two characters would make every consumer undo it; the overwrite case never occurs in the pool today (Surprises & Discoveries), and a wrong label published silently is worse than a run that asks a person.
  Date/Author: 2026-10-31, agent.

- Decision: K7 — an H.I.F. ability (`MemoryAbility` with `produceGroupIds` exactly `[produce_group-003]`) is published as `{ id, card }` when its card is in the pool. The generator stops, naming the ability, when its skill is missing, when the skill's effect ids are not exactly one id of the form `p_effect-exam_status_enchant-enchant-p_ef-hif_memory-<card id>-enc02`, when that card does not exist, or when the card exists and is released but is not in the pool. An ability whose card exists but is not released yet is left out without stopping.
  Rationale: the issue asks for a stop when an id does not resolve to a pool card; gkms-memomemo's requirements also say the list holds abilities "whose card is released", so an unreleased card is the one case that is expected, not broken.
  Date/Author: 2026-10-31, agent.

- Decision: K8 — any other surprise in the eight tables also stops the run, writing nothing: a missing field or one of another type (K15), a plan, rarity or category value the code does not know on a row the pool would otherwise hold (released, at level 0 or 1, not P-idol unique, support-card event or starter), a customization or grow-effect id that resolves to nothing, a step with no label, a row the pool would hold twice (K16), or a playable idol whose `order` repeats another's. An unknown enum value on a row the source rules already leave out does not stop the run.
  Rationale: the existing generator's rule for a dump that looks broken (`CLAUDE.md` § Build and Test, `bun run generate`), applied to the new tables; with K2 it makes a person look before anything is published. The exception is deliberate: under K2 a stop also holds back the support card update, and a value on a row that can never reach the file changes nothing that is published. The Codex review of Milestone 1 asked for every row to be checked; that was declined for this reason.
  Date/Author: 2026-10-31, agent; the scope sentence added after the Codex review the same day.

- Decision: K9 — the icon rendition keeps the name `w112/`: the textures are 256 × 256, wider than 112 (Surprises & Discoveries). Each icon is stored as a lossless master `master/<asset name>.webp` with its transparency and no reshape (like the P-item icons of `docs/adr/0003`'s 2026-09-29 addendum) and a lossy 112 × 112 rendition with alpha `w112/<asset name>.webp`, where `<asset name>` is the bundle name without `.unity3d`.
  Rationale: gkms-memomemo's D35 chose 112 as twice its 56-pixel icon; the rule to rename the prefix applied only to narrower textures.
  Date/Author: 2026-10-31, agent, from the measurement.

- Decision: K10 — a sprite sheet is a WebP grid of 112 × 112 cells in a fixed 10 columns, its cells in the order of the cards' `order` strings. Each cell is made from the icon's lossless master, resized exactly as the `w112/` rendition is, so every icon is compressed once, by the sheet's own lossy encoding. The WebP quality is chosen in Milestone 4 by measuring all 39 sheets against the target of about half a megabyte per sheet, and recorded.
  Rationale: building from the lossy `w112/` files would compress each icon twice; a fixed column count keeps the index simple and a sheet of 68 cells at 1120 × 784 pixels well inside every browser's limits.
  Date/Author: 2026-10-31, agent.

- Decision: K11 — a sheet is stale, and is rebuilt under a new name, when the stored index has no entry for its plan and idol, or has one whose `cell`, `columns` or `assets` list differs from the one the pipeline would write now. Otherwise the stored entry, file name included, is kept as it is. The bytes of a sheet are never compared or recomputed; `sheets.py --rebuild` rebuilds every sheet after a change of the rendering rule (size, quality, layout).
  Rationale: WebP output can differ between library versions (a person's machine against the runner), so a byte comparison would rebuild sheets that did not change; the list of cells is what the consumer depends on, and an icon never changes under its name in this pipeline (it is extracted once and never refetched).
  Date/Author: 2026-10-31, agent.

- Decision: K12 — the upload order is: for each missing icon, its master and then its `w112/` rendition; then each stale sheet; then the index, last. An icon that the stored index names is therefore known to be stored, so the pipeline sends a `HEAD` only for icons the index does not name. In a normal run that is one `GET` of the index and no `HEAD` at all.
  Rationale: on the Workers Free plan every `/img/*` request runs the Worker and counts toward the account's 100,000 requests a day, shared by every `tia.run` Worker; a `HEAD` per icon would cost about 1,700 requests per run, twice a day.
  Date/Author: 2026-10-31, agent.

- Decision: K13 — when a sheet is stale on a runner that has none of its icons, the icons are extracted from the game's bundles (about 10–30 KB each) rather than downloaded through this site's Worker.
  Rationale: no Worker requests are spent; the bundles come from the same source as everything else in the pipeline, which is already best effort in the daily workflow.
  Date/Author: 2026-10-31, agent.

- Decision: K14 — the index `sheet112/index.v1.json` is stored and served with `Cache-Control: no-cache` and `Content-Type: application/json`; sheets and icons are immutable like every other public image. Sheets the index no longer names are left in the bucket.
  Rationale: the pipeline reads the index through this Worker to plan, so a cached copy could hide a fresh one; gkms-memomemo's Worker reads the bucket directly and sets its own one-hour cache. An old sheet costs a fraction of a megabyte of storage and deleting it could break a page that loaded the previous index a moment earlier.
  Date/Author: 2026-10-31, agent.

- Decision: K15 — the skill card tables are loaded by `loadTypedTable` in `scripts/lib/tables.ts`, which checks that every declared field of every row has its YAML type (`string`, `number`, `boolean` or a list of strings) and otherwise stops, naming the table, the row and the field. The support card tables keep `loadTable`, which checks only that the keys exist.
  Rationale: found by the Codex review of Milestone 1. A wrongly typed value that reaches the generated module is caught by `bun run type-check`, a gate of the daily update, but some would silently fail a comparison instead: an `upgradeCount` of `"1"` drops the card from the pool, a `produceGroupIds` given as a string drops every ability, a string `Character.order` leaves the idols unsorted. The support card tables have the same gap, but it predates this plan and is outside its scope; it is named as residual risk in the pull request.
  Date/Author: 2026-10-31, agent, from the Codex review.

- Decision: K16 — the pool is sorted by `order`, then card id, then upgrade level, and a `(id, upgradeCount)` the pool would hold twice stops the run.
  Rationale: found by the Codex review of Milestone 1: two cards sharing an `order` would otherwise be listed base, base, +, +, and a duplicated row would be published twice. Neither happens in today's data (181 distinct orders).
  Date/Author: 2026-10-31, agent, from the Codex review.

- Decision: K17 — two findings of the Codex review of Milestone 1 were declined. A customization step with a description and no grow effect is accepted, because grow effects are read only to label a step that has no description and none is published. An H.I.F. ability whose skill has several level rows is accepted when every level names the same card, because the published pair is then still right; levels naming different cards stop the run, now under a test.
  Rationale: stopping the daily update (and with it the support card data, K2) for a row whose published value is fully determined would cost a day's update for nothing.
  Date/Author: 2026-10-31, agent.

- Decision: K18 — sprite sheets are encoded at WebP quality 80 with an exact alpha channel (`SHEET_QUALITY` in `scripts/images/sheet_rules.py`): 118–124 KB per sheet, about 4.7 MB for all 39.
  Rationale: measured against the half-megabyte target, every quality from 50 to 90 fits (Surprises & Discoveries); 80 is what the other renditions use and shows no visible artifacts at twice the display size, while a player loads at most three sheets per idol.
  Date/Author: 2026-10-31, agent, from the measurement.

## Outcomes & Retrospective

Nothing yet; Milestone 1 is next.

## Context and Orientation

This repository builds `https://gakumas-supportcards.tia.run`, a static page of support card scores, and publishes game data and art for sibling pages. The pieces this plan touches, with how they work today:

The upstream game data is `vertesan/gakumasu-diff`, a public dump of the game's master tables as YAML files. `scripts/lib/tables.ts` declares the tables the generators read and only the fields read: `loadTable<T>(name, keys)` reads `.cache/gakumasu-diff/<Table>.yaml` when present (the directory is gitignored), otherwise fetches `https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/<Table>.yaml` and caches it, and throws unless every row has every declared key; `loadTables()` loads the support card tables in parallel. `GAKUMASU_DIFF_CACHE=<dir>` points it at another directory.

`bun run generate` runs `scripts/generate-cards.ts`. It loads the tables, builds the support cards with pure functions in `scripts/lib/`, checks that the card count did not drop, and writes the committed modules `data/cards.generated.ts`, `data/held.generated.ts`, `data/levelLimits.generated.ts` and `data/scores.generated.json` through the emitters of `scripts/lib/emit.ts`, which write one JSON object per line under a header saying the file is generated. Output is deterministic: a second run gives no diff. When the dump looks broken (a schema error, an unknown enum value, a dangling id) it exits 1 before writing anything.

`bun run build` runs Vite (`vite.config.ts`). A build-only plugin, `cardDataFile()`, emits `dist/data/cards.v1.json` from the generated modules through `cardDataJson()` of `data/card-data-file.ts`; the page itself never reads that file. `docs/adr/0010` makes the file a contract: any change of its shape bumps the format version, which is part of the file name. `data/card-data-file.test.ts` checks that the text parses back to the modules and that the real Vite build, run in memory, writes it at its path.

The images live in the Cloudflare R2 bucket `tia-assets` (R2 is Cloudflare's object storage). Per `docs/adr/0003`, every image is stored twice under the game's own file name: a private lossless master under `master/`, never served, and a public rendition under a prefix named for its width (`w192/` for support card art, `w48/` for P-item icons). The Python pipeline in `scripts/images/` (run with `uv`) makes them: `extract.py` fetches the game's asset manifest and bundles through GkmasObjectManager, a GPL-3.0 tool unpacked at a pinned commit into the gitignored `scripts/images/vendor/` by `fetch-vendor.sh`, decodes each bundle with our `decode.py`, and writes `out/master/` and the public rendition under `out/`; `upload.py` uploads what the deployed site lacks with `bunx wrangler r2 object put`, the master before the public rendition so that a served rendition always has a stored master. Both decide "missing" by asking the deployed site with `HEAD /img/<prefix>/<file>` (`deployed_site.py`), and both publish only files of cards listed in the generated data, because the manifest carries art of unreleased cards. The naming and image rules are pure functions in `thumbnail.py` and `uploads.py`, tested by `uv run pytest` without network.

The Worker in `infra/worker/` serves the site. `wrangler.toml` sends only `/img/*` and `/feedback` through it; `img.ts` answers `GET` and `HEAD` for a path that its pattern `IMAGE_PATH` accepts, reading the bucket bound as `IMAGES`, with `Cache-Control: public, max-age=31536000, immutable`, and answers 404 with `no-store` for anything else, `master/` included. The dev server (`bun run dev`) answers the same paths from `scripts/images/out/` through the plugin `localImageLibrary()` in `vite.config.ts`, using the Worker's own `imageKey()`.

The daily update, `.github/workflows/update-data.yml`, runs `bun run generate` on a runner, stops if nothing under `data/` changed, runs the gates (`bun test`, `bun run type-check`, `bun run lint`, `bun scripts/check-score-stability.ts`), runs the image step as best effort (`./fetch-vendor.sh`, `uv sync --frozen`, `uv run extract.py --only-missing`, `uv run upload.py`), then commits `data` with `git add data`, merges it into `main` through a pull request, and deploys. `scripts/lib/workflows.test.ts` pins the workflows' shape.

Terms from the game used here. A skill card (`ProduceCard`) is a card played in lessons and contests; one id has rows for `upgradeCount` 0 (the base card), 1 (the + card), 2 and 3. A training plan is センス, ロジック or アノマリー (`planType` `ProducePlanType_Plan1`, `Plan2`, `Plan3`), or free (`ProducePlanType_Common`). A P-idol is a playable idol (`Character` with `isPlayable: true`); SR and SSR cards are drawn differently per idol (`isCharacterAsset: true`, bundle `<assetId>-<idol id>.unity3d`), others have one image (`<assetId>.unity3d`). A customization (カスタマイズ) is an upgrade a + card can take: the card lists its kinds in `produceCardCustomizeIds` and a limit `maxCustomizeCount`; a kind is a `ProduceCardCustomize` id whose rows are its steps, numbered by `customizeCount`. A produce memory carries one skill card into a later produce; H.I.F. (初星アイドルフェスティバル) memories also carry an H.I.F. ability (`MemoryAbility`), each belonging to one skill card. A sprite sheet is one image holding many icons side by side in a grid; a page shows one icon by drawing the sheet as a background positioned at that icon's cell.

The pool (the cards that can be a produce memory, gkms-memomemo's D8, D37, D38) is every released `ProduceCard` row at `upgradeCount` 0 or 1, except P-idol unique cards (`searchTag: idol-unique`), support-card event cards (`originSupportCardId` not empty), starter cards (`searchTag: starter`, except level 0 of 表現の基本 `p_card-00-men-0_003`), trouble cards (`category: ProduceCardCategory_Trouble`) and Legend cards (`rarity: ProduceCardRarity_Legend`).

## Plan of Work

Milestone 1 publishes the data file. In `scripts/lib/tables.ts`, add the raw row types `RawProduceCard` (`id`, `upgradeCount`, `name`, `assetId`, `isCharacterAsset`, `rarity`, `planType`, `category`, `searchTag`, `originSupportCardId`, `produceCardCustomizeIds`, `maxCustomizeCount`, `viewStartTime`, `order`), `RawCardCustomize` (`id`, `customizeCount`, `description`, `overwriteProduceCardGrowEffectType`, `produceCardGrowEffectIds`), `RawGrowEffect` (`id`, `effectType`), `RawGrowEffectDescription` (`type`, `produceCardCustomizeDescription`), `RawMemoryAbility` (`id`, `skillId`, `produceGroupIds`), `RawGuideCategory` (`label`, `produceCardIds`) and `RawCharacter` (`id`, `lastName`, `firstName`, `isPlayable`, `order`), and a `loadSkillCardTables(opts)` that loads those seven tables in parallel; `ProduceSkill` is already loaded by `loadTables()` with `id` and `produceEffectId1..3`, so the generator passes those rows in rather than parsing the 7 MB file twice. Create `data/skillcard-data-file.ts` with the contract types (Interfaces and Dependencies), `SKILLCARD_DATA_FORMAT_VERSION`, `SKILLCARD_DATA_PATH` and `skillCardDataJson(data)`. Create `scripts/lib/build-skillcards.ts`, pure, with `buildSkillCardData(tables, skills, now): SkillCardDataFile`, applying the pool rule, the label rule (K6), the guide labels, the idols and the H.I.F. abilities (K7), and throwing an `Error` naming the row for every case of K6, K7 and K8. Add `emitSkillCards(data)` to `scripts/lib/emit.ts`, writing `data/skillcards.generated.ts` as `export const SKILL_CARD_DATA: SkillCardDataFile = {…};` where the object is valid JSON with one card or ability per line, so that `scripts/images/` can read it with `json.loads` after cutting the text from the first `{` after `export const SKILL_CARD_DATA` to the last `}`. In `scripts/generate-cards.ts`, load the skill card tables with the others, build the skill card data before writing anything (so K2 holds), write the module with the others and print its counts. In `vite.config.ts`, add a build-only plugin `skillCardDataFile()` beside `cardDataFile()`. Tests: `scripts/lib/build-skillcards.test.ts` covers each rule on small fixtures and is seen to fail with each rule broken; `data/skillcard-data-file.test.ts` checks that the text parses back to the module, that the Vite build writes it at `data/skillcards.v1.json` (the in-memory build helper moves from `data/card-data-file.test.ts` into `data/built-asset.ts`, shared by both), and that the committed module reads as JSON by the cut `scripts/images` will use. Run `bun run generate` and check that only `data/skillcards.generated.ts` is new and the counts match Surprises & Discoveries. Add an addendum to `docs/adr/0010` (a second published file for gkms-memomemo, its own version constant, the release rule K4) and update `CLAUDE.md`. Review the diff with `/codex-review`, open the pull request into `develop`, and after the user merges it and approves, merge `develop` into `main`. Acceptance: the `curl` of the data file in Purpose shows `formatVersion` 1 and the idols.

Milestone 2 widens the Worker. In `infra/worker/img.ts`, extend `IMAGE_PATH` to also accept `w112/img_general_skillcard_(act|men|ido)-<digits>_<three digits>` with an optional `-<four lowercase letters or digits>` and `.webp`, `sheet112/(sense|logic|anomaly)-<four lowercase letters or digits>-<eight hex digits>.webp`, and `sheet112/index.v1.json`; give the response its content type and cache rule per key (`application/json` and `no-cache` for the index, K14; `image/webp` and immutable for the rest), exported for the dev server. Change `localImageLibrary()` in `vite.config.ts` to use the same content type. Extend `infra/worker/img.test.ts`: each new path answers from the fake bucket with the right headers, `master/` and neighbours of the new patterns (a sheet with seven hex digits, an index of another version, `w112/` of a support card) stay 404. Acceptance: `bun test infra/worker` passes; `bun run dev` serves a locally extracted icon at `/img/w112/…`.

Milestone 3 extracts and uploads the single icons. Add `scripts/images/skillcards.py`, pure: `read_skill_card_data(module_text)` (the JSON cut of Milestone 1), `icon_names(data)` (for each level-0 card, `<asset>-<idol>.webp` per playable idol when `perIdol`, else `<asset>.webp`) and the manifest pattern for skill card icons. Extend `thumbnail.py` with the `w112/` prefix and the rules `to_skillcard_master` (lossless, alpha kept, no reshape) and `to_skillcard_icon` (112 × 112, alpha, the same quality as the other renditions), selected by the file name's stem, and extend `extract.py` and `upload.py` so that skill card icons go through the same steps as item icons: offered names from the manifest, wanted names limited to `icon_names` of the generated module, `--rendition w112`. "Missing" for skill card icons follows K12: names in the stored sheet index count as present, the rest are asked with `HEAD`. Tests in `test_thumbnail.py`, `test_uploads.py` and a new `test_skillcards.py` (which also reads the committed `data/skillcards.generated.ts`, so a change of the emitter that Python cannot read fails here). Run a full local extraction and record its time and sizes. Acceptance: `uv run pytest` passes; `uv run extract.py --only 'skillcard'` writes 1,693 masters and 1,693 renditions; `uv run upload.py --dry-run` lists them as missing and uploads nothing.

Milestone 4 builds the sheets. Add `scripts/images/sheet_rules.py`, pure: the desired entries per plan and idol from the data (assets ordered by `order`, free cards included), the cell position of an asset, `stale(desired, stored_index)` (K11), the file name from bytes (`sheet112/<plan>-<idol>-<first 8 hex digits of SHA-256>.webp`) and the index text. Add `scripts/images/sheets.py`: read the stored index from the deployed site (`GET`, 404 meaning none), find the stale sheets, compose each from the local masters (K10), encode, upload each sheet, then upload the index (K12, K14); `--dry-run`, `--rebuild`, `--quality`. Make `extract.py --only-missing` also fetch the icons of stale sheets that are not on disk (K13). Measure the sheet sizes at a few qualities, choose one, record it. Add `uv run sheets.py` to the image step of `update-data.yml` after `uv run upload.py`, and pin it in `scripts/lib/workflows.test.ts`. Update `scripts/images/README.md`. Acceptance: `uv run pytest` passes; `uv run sheets.py --dry-run` lists 39 stale sheets with their cell counts (68, 68, 65); the composed sheets look right when opened.

Milestone 5 releases. Add an addendum to `docs/adr/0003` (the `w112/` and `sheet112/` prefixes, the index, K11, K12, K14), update `CLAUDE.md` and `infra/worker/README.md`, review with `/codex-review`, open the pull request into `develop`, and after the user merges it, close #65 with the board's `done` step. After the user approves the release, merge `develop` into `main`; once `deploy.yml` has deployed the Worker, ask the user before the first bulk upload (about 3,400 objects with their Wrangler login; the daily job runs its image step only when the data changes, so it would not do this by itself), then run `uv run upload.py` and `uv run sheets.py`. Acceptance: the three commands in Purpose answer as shown. Then run the close-out ritual.

## Concrete Steps

All commands run from the repository root unless a directory is named. Install once:

    BUN_INSTALL_CACHE_DIR="$TMPDIR/bun-cache" bun install --frozen-lockfile
    (cd scripts/images && ./fetch-vendor.sh && uv sync)

The checks, each judged by its exit status:

    bun test
    bun run type-check
    bun run lint
    bun scripts/check-score-stability.ts
    bun run build
    (cd scripts/images && uv run pytest)

Regenerating (fetches today's tables into `.cache/gakumasu-diff/` when absent; delete a table there to refetch it):

    bun run generate

Expected, after Milestone 1, in addition to the existing lines:

    Wrote data/skillcards.generated.ts: 13 idols, 181 cards at level 0 and 180 at level 1, 115 H.I.F. abilities

## Validation and Acceptance

Milestone 1 is accepted when `bun test`, `bun run type-check`, `bun run lint`, `bun scripts/check-score-stability.ts` and `bun run build` exit 0, `dist/data/skillcards.v1.json` exists and parses to the committed module, every new rule test was seen to fail with its rule broken, and after the release `curl -s https://gakumas-supportcards.tia.run/data/skillcards.v1.json | head -c 300` begins with `{"formatVersion":1,"idols":[{"id":"hski","name":"花海咲季"}`.

The plan is accepted when, after the second release and the first upload: `curl -s https://gakumas-supportcards.tia.run/img/sheet112/index.v1.json` lists 39 sheets with 68, 68 and 65 assets for each idol; `curl -sI` of a sheet it names answers 200 with `Content-Type: image/webp` and the immutable cache header; `curl -sI https://gakumas-supportcards.tia.run/img/w112/img_general_skillcard_act-3_029-hski.webp` answers 200; `curl -sI https://gakumas-supportcards.tia.run/img/master/img_general_skillcard_act-3_029-hski.webp` answers 404; and a second run of `uv run sheets.py --dry-run` reports every sheet current.

## Idempotence and Recovery

Generation is deterministic for a given clock and tables, and writes nothing when it fails. `extract.py` skips files that already have both renditions on disk; `upload.py` and `sheets.py` upload only what is missing or stale, in an order that leaves the bucket consistent if a run stops partway (an icon's master before its rendition, sheets before the index), so rerunning completes the work. A sheet uploaded without its index entry is harmless: nothing names it. A bad index can be replaced by rerunning `sheets.py --rebuild`. The data file is rebuilt on every deploy from the committed module; reverting the module's commit and deploying restores the previous file.

## Artifacts and Notes

Scratch scripts and tables for the readings in Surprises & Discoveries lived in `$TMPDIR/skc/` and are not kept; the commands to repeat them are the counts above over the YAML tables.

## Interfaces and Dependencies

No new dependency: TypeScript uses `js-yaml` (already a dev dependency) and Bun; Python uses Pillow and UnityPy (already in `scripts/images/pyproject.toml`) and GkmasObjectManager at its pinned commit.

`data/skillcard-data-file.ts` defines, with no imports:

    export const SKILLCARD_DATA_FORMAT_VERSION = 1;
    export const SKILLCARD_DATA_PATH = `data/skillcards.v${SKILLCARD_DATA_FORMAT_VERSION}.json`;
    export type SkillCardPlan = "sense" | "logic" | "anomaly" | "free";
    export type SkillCardRarity = "N" | "R" | "SR" | "SSR" | "Legend";
    export type SkillCardType = "active" | "mental";
    export interface Idol { id: string; name: string }                 // Character id, lastName + firstName
    export interface CustomizationStep { step: number; label: string }  // customizeCount; label per K6
    export interface CustomizationKind { id: string; steps: readonly CustomizationStep[] }
    export interface SkillCard {
      id: string;                // ProduceCard id
      upgrade: number;           // upgradeCount, 0 or 1
      name: string;              // as the game writes it at that level
      plan: SkillCardPlan;
      rarity: SkillCardRarity;
      type: SkillCardType;
      order: string;             // the game's sort key
      guideLabels: readonly string[];
      art: { asset: string; perIdol: boolean };
      customization: { limit: number; kinds: readonly CustomizationKind[] };
    }
    export interface HifAbility { id: string; card: string }            // MemoryAbility id, ProduceCard id
    export interface SkillCardDataFile {
      formatVersion: typeof SKILLCARD_DATA_FORMAT_VERSION;
      idols: readonly Idol[];
      cards: readonly SkillCard[];
      hifAbilities: readonly HifAbility[];
    }
    export function skillCardDataJson(data: SkillCardDataFile): string;

`Legend` stays in `SkillCardRarity` although the pool excludes Legend cards, because gkms-memomemo's requirements list it among the values. Cards are listed by `order`, then `upgrade`; abilities by id. `scripts/lib/build-skillcards.ts` exports `buildSkillCardData(tables: SkillCardTables, skills: readonly RawProduceSkill[], now: number): SkillCardDataFile`, and its parts `buildPool`, `buildIdols`, `buildHifAbilities`, `stepLabel` and `isReleased` for the tests. It throws a plain `Error` whose message begins with the row it names, as `scripts/lib/build-cards.ts` does; `scripts/generate-cards.ts` exits 1 on any throw.

The sheet index `sheet112/index.v1.json`, written by `scripts/images/sheet_rules.py`:

    { "formatVersion": 1, "cell": 112, "sheets": [
      { "plan": "sense", "idol": "hski", "file": "sheet112/sense-hski-1a2b3c4d.webp", "columns": 10,
        "assets": ["img_general_skillcard_act-1_001", "img_general_skillcard_act-3_029-hski", …] }, … ] }

`assets` names the cells in order, row by row, as asset names without `.webp`; sheets are listed by plan (sense, logic, anomaly) and then by idol in the game's order.
