import { useMemo } from "preact/hooks";
import { CARDS } from "../../data/cards.generated.ts";
import { HELD } from "../../data/held.generated.ts";
import { LEVEL_LIMITS } from "../../data/levelLimits.generated.ts";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import type { Totsu } from "../engine/types.ts";
import { Controls } from "./Controls.tsx";
import { CustomizePanel } from "./CustomizePanel.tsx";
import { ScoreTable } from "./ScoreTable.tsx";
import { applyOverrides, buildPanel, triggersOf } from "./panel.ts";
import { buildRows, filterRows, sortRows, withoutHeld } from "./rows.ts";
import { resolveSelection } from "./url-state.ts";
import { ALL_TRIGGERS, useUrlState } from "./useUrlState.ts";

/** Cards with an effect the pipeline cannot count are not shown at all (docs/adr/0005). */
const SHOWN_CARDS = withoutHeld(CARDS, HELD);

export function App() {
  const [state, update] = useUrlState();
  const { scenario, profile } = resolveSelection(state, SCENARIOS);

  const scored = useMemo(() => buildRows(SHOWN_CARDS, { scenarioId: scenario.id, profile: applyOverrides(profile, state.overrides), limits: LEVEL_LIMITS }, state.split), [scenario, profile, state.overrides, state.split]);
  const rows = useMemo(() => sortRows(filterRows(scored, state), state.sort), [scored, state.types, state.plans, state.rarities, state.sort]);

  // Which inputs the panel folds away depends on the cards in view, not on their order.
  const sections = useMemo(() => buildPanel(profile, state.overrides, ALL_TRIGGERS, triggersOf(rows.map((r) => r.card))), [profile, state.overrides, rows]);

  const onSort = (totsu: Totsu): void => update({ sort: { totsu, desc: state.sort.totsu === totsu ? !state.sort.desc : true } });

  return (
    <div class="mx-auto max-w-6xl p-3 sm:p-6 flex flex-col gap-4">
      <header class="flex flex-col gap-1">
        <h1 class="text-xl font-bold">サポカ凸別点数一覧</h1>
        <p class="text-xs text-slate-500">
          点数 = 1回のプロデュースで得られる Vo+Da+Vi 上昇量の期待値。全レッスンをSPレッスン、条件付き効果は常に成立とみなします。数字にカーソルを合わせると内訳、サムネイルに合わせるとカード名が表示されます。
        </p>
      </header>
      <section class="rounded-lg border border-slate-200 bg-white p-3">
        <Controls scenarios={SCENARIOS} scenario={scenario} profile={profile} state={state} update={update} />
      </section>
      <CustomizePanel profileName={profile.name} sections={sections} overrides={state.overrides} onChange={(overrides) => update({ overrides })} />
      <section class="rounded-lg border border-slate-200 bg-white overflow-visible">
        <ScoreTable rows={rows} sort={state.sort} onSort={onSort} />
      </section>
      <footer class="text-xs text-slate-500">
        {scenario.name}（パラメータ上限 {scenario.parameterCap}）。カードデータは vertesan/gakumasu-diff から毎週生成。
      </footer>
    </div>
  );
}
