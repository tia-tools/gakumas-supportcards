import { useMemo } from "preact/hooks";
import { CARDS } from "../../data/cards.generated.ts";
import { LEVEL_LIMITS } from "../../data/levelLimits.generated.ts";
import { SCENARIOS } from "../../data/scenarios/index.ts";
import { TAXONOMY } from "../../data/taxonomy.generated.ts";
import { taxonomyMap } from "../engine/score.ts";
import type { Totsu } from "../engine/types.ts";
import { Controls } from "./Controls.tsx";
import { CustomizePanel } from "./CustomizePanel.tsx";
import { ScoreTable } from "./ScoreTable.tsx";
import { applyOverrides, buildRows, filterRows, sortRows } from "./rows.ts";
import { resolveSelection } from "./url-state.ts";
import { useUrlState } from "./useUrlState.ts";

const TAXONOMY_MAP = taxonomyMap(TAXONOMY);

export function App() {
  const [state, update] = useUrlState();
  const { scenario, profile } = resolveSelection(state, SCENARIOS);

  const scored = useMemo(() => buildRows(CARDS, { profile: applyOverrides(profile, state.overrides), taxonomy: TAXONOMY_MAP, limits: LEVEL_LIMITS }, state.split), [profile, state.overrides, state.split]);
  const rows = useMemo(() => sortRows(filterRows(scored, state), state.sort), [scored, state.types, state.plans, state.rarities, state.sort]);

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
      <CustomizePanel profile={profile} taxonomy={TAXONOMY} overrides={state.overrides} onChange={(overrides) => update({ overrides })} />
      <section class="rounded-lg border border-slate-200 bg-white overflow-visible">
        <ScoreTable rows={rows} sort={state.sort} onSort={onSort} />
      </section>
      <footer class="text-xs text-slate-500">
        {scenario.name}（パラメータ上限 {scenario.parameterCap}）。カードデータは vertesan/gakumasu-diff から毎週生成。
      </footer>
    </div>
  );
}
