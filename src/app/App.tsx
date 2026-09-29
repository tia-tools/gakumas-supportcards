import { useMemo } from "preact/hooks";
import { CARDS } from "../../data/cards.generated.ts";
import { HELD } from "../../data/held.generated.ts";
import { LEVEL_LIMITS } from "../../data/levelLimits.generated.ts";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import type { Totsu } from "../engine/types.ts";
import { Controls } from "./Controls.tsx";
import { CustomizePanel } from "./CustomizePanel.tsx";
import { FeedbackForm, FeedbackLink } from "./FeedbackForm.tsx";
import { Hint } from "./Hint.tsx";
import { ItemPanel } from "./ItemPanel.tsx";
import { ScoreTable } from "./ScoreTable.tsx";
import { deckDrinks, itemCapsOf, itemRows } from "./item-panel.ts";
import { applyOverrides, buildPanel, triggersOf } from "./panel.ts";
import { buildRows, filterRows, sortRows, withoutHeld } from "./rows.ts";
import { resolveSelection, shareFor } from "./url-state.ts";
import { ALL_TRIGGERS, useUrlState } from "./useUrlState.ts";

/** Cards with an effect the pipeline cannot count are not shown at all (docs/adr/0005). */
const SHOWN_CARDS = withoutHeld(CARDS, HELD);

export function App() {
  const [state, update] = useUrlState();
  const { scenario, profile } = resolveSelection(state, SCENARIOS);

  // The profile with the player's counts; the drinks ticked P-items add come on top (they are counted from this profile, so not from themselves).
  const applied = useMemo(() => applyOverrides(profile, state.overrides), [profile, state.overrides]);
  // The lesson split in force for the P-items: the selected preset, or null under 「カードごとに最適」 (A25).
  const itemCtx = useMemo(() => ({ scenarioId: scenario.id, profile: applied, lessons: state.split === null ? null : (profile.lessonSplits[state.split] ?? null) }), [scenario, applied, profile, state.split]);
  const drinks = useMemo(() => deckDrinks(SHOWN_CARDS, itemCtx, state.overrides), [itemCtx, state.overrides]);
  const scored = useMemo(
    () => buildRows(SHOWN_CARDS, { scenarioId: scenario.id, profile: applyOverrides(profile, state.overrides, drinks), limits: LEVEL_LIMITS, share: shareFor(state, profile), itemCaps: itemCapsOf(state.overrides) }, state.split),
    [scenario, profile, state.overrides, state.split, state.shares, drinks],
  );
  const rows = useMemo(() => sortRows(filterRows(scored, state), state.sort), [scored, state.types, state.plans, state.rarities, state.sp, state.sort]);

  // Which inputs the panel folds away depends on the cards in view, not on their order.
  const sections = useMemo(() => buildPanel(profile, state.overrides, ALL_TRIGGERS, triggersOf(rows.map((r) => r.card)), drinks), [profile, state.overrides, rows, drinks]);
  const items = useMemo(() => itemRows(rows.map((r) => r.card), itemCtx, state.overrides), [itemCtx, rows, state.overrides]);

  const onSort = (totsu: Totsu): void => update({ sort: { totsu, desc: state.sort.totsu === totsu ? !state.sort.desc : true } });

  return (
    <div class="mx-auto max-w-6xl p-3 sm:p-6 flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="flex items-center gap-2">
            <h1 class="text-xl font-bold">サポカ凸別点数一覧</h1>
            <Hint hint="点数 = 1回のプロデュースで得られる Vo+Da+Vi 上昇量の期待値" label="点数の説明">
              <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-semibold text-slate-500">i</span>
            </Hint>
          </span>
          <FeedbackLink />
        </div>
      </header>
      <section class="rounded-lg border border-slate-200 bg-white p-3">
        <Controls scenarios={SCENARIOS} scenario={scenario} profile={profile} state={state} update={update} />
      </section>
      <CustomizePanel profileName={profile.name} sections={sections} overrides={state.overrides} onChange={(overrides) => update({ overrides })} />
      <ItemPanel items={items} overrides={state.overrides} onChange={(overrides) => update({ overrides })} />
      <section class="rounded-lg border border-slate-200 bg-white overflow-visible">
        <ScoreTable rows={rows} sort={state.sort} onSort={onSort} />
      </section>
      <FeedbackForm />
      <footer class="text-xs text-slate-500">
        {scenario.name}（パラメータ上限 {scenario.parameterCap}）。
      </footer>
    </div>
  );
}
