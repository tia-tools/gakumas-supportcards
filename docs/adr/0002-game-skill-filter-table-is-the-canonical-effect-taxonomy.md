---
status: accepted
---

# The game's own SupportCardProduceSkillFilter table is the canonical effect taxonomy

Route profiles assign an expected count to each kind of support-card effect, so the set of kinds must be stable and complete. We take it from the game data itself: `SupportCardProduceSkillFilter.yaml` in the `vertesan/gakumasu-diff` dump (46 rows in September 2026), each row giving a Japanese title as shown in game (e.g. 「SPレッスン終了時パラメータ上昇」), the effect types it covers, and the exact trigger ids it covers. A card effect that matches no row fails the data build loudly instead of being dropped. Alternatives rejected: our own coarse categories (a code change for every new mechanic, labels that are ours rather than the game's) and mirroring a third-party site's input list (drifts from game data).

Source: user decision D3, grill-me session 2026-09-16 (`docs/plans/EXECPLAN_SUPPORT_CARD_SCORE_TABLE.md` § Decision Log). Evidence that the table is complete enough: the previous project's generator dropped HIF-era effects precisely because it used a hand-made 5-phase mapping (same session, dry run of `gakumas-hajime-lesson/scripts/generate-supportcards.ts`).

Addendum 2026-09-17 (status unchanged, scope refined): Milestone 0 of the same plan read every card and found the game table incomplete as a map of triggers — five cards use conditional or new trigger ids no row lists, and P-item triggers were never in it. The taxonomy is therefore the game table **first**, plus a small hand-maintained extension list (`data/taxonomy.extensions.ts`) in the same row shape, one row per uncovered trigger, titled in the game's own wording, optionally pointing at the game category whose route count it shares. The build still fails on any unmatched effect, and additionally fails when a game row comes to cover a trigger an extension row covers, so extensions retire automatically. Conditional trigger ids resolve to a row by longest `-`-delimited prefix. Source: plan Decision Log D13–D14, accepted by the user 2026-09-17 after the prototype run showed zero unclassified pairs with six extension rows.
