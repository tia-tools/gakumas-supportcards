/** Scenario, route profile and lesson-split selectors plus the type / plan / rarity facet toggles. */

import type { CardType, Plan, Rarity, Scenario, RouteProfile } from "../engine/types.ts";
import { PLAN_LABEL, RARITY_LABEL, TYPE_LABEL } from "./labels.ts";
import { CARD_TYPES, PLANS, RARITIES, type ViewState } from "./url-state.ts";
import type { UpdateViewState } from "./useUrlState.ts";

interface Props {
  scenarios: readonly Scenario[];
  scenario: Scenario;
  profile: RouteProfile;
  state: ViewState;
  update: UpdateViewState;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Facet<T extends string>({ label, values, selected, labels, onToggle }: { label: string; values: readonly T[]; selected: readonly T[]; labels: Readonly<Record<T, string>>; onToggle: (v: T) => void }) {
  return (
    <fieldset class="flex flex-wrap items-center gap-1">
      <legend class="sr-only">{label}</legend>
      <span class="text-xs text-slate-500 mr-1">{label}</span>
      {values.map((v) => {
        const on = selected.includes(v);
        return (
          <button key={v} type="button" aria-pressed={on} onClick={() => onToggle(v)} class={`px-2 py-0.5 rounded-full text-xs border transition ${on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"}`}>
            {labels[v]}
          </button>
        );
      })}
    </fieldset>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label class="flex items-center gap-1 text-sm">
      <span class="text-xs text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)} class="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const splitLabel = (s: RouteProfile["lessonSplits"][number]): string => `Vo${s.vocal} / Da${s.dance} / Vi${s.visual}`;

export function Controls({ scenarios, scenario, profile, state, update }: Props) {
  const splitOptions = [{ value: "best", label: "カードごとに最適" }, ...profile.lessonSplits.map((s, i) => ({ value: String(i), label: splitLabel(s) }))];
  return (
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-4">
        <Select label="シナリオ" value={scenario.id} options={scenarios.map((s) => ({ value: s.id, label: s.name }))} onChange={(id) => update({ scenarioId: id, profileId: scenarios.find((s) => s.id === id)?.profiles[0]?.id ?? "", split: null, overrides: {} })} />
        <Select label="育成ルート" value={profile.id} options={scenario.profiles.map((p) => ({ value: p.id, label: p.name }))} onChange={(id) => update({ profileId: id, split: null })} />
        <Select label="レッスン配分" value={state.split === null ? "best" : String(state.split)} options={splitOptions} onChange={(v) => update({ split: v === "best" ? null : Number(v) })} />
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Facet label="タイプ" values={CARD_TYPES} selected={state.types} labels={TYPE_LABEL} onToggle={(v: CardType) => update({ types: toggle(state.types, v) })} />
        <Facet label="プラン" values={PLANS} selected={state.plans} labels={PLAN_LABEL} onToggle={(v: Plan) => update({ plans: toggle(state.plans, v) })} />
        <Facet label="レアリティ" values={RARITIES} selected={state.rarities} labels={RARITY_LABEL} onToggle={(v: Rarity) => update({ rarities: toggle(state.rarities, v) })} />
      </div>
    </div>
  );
}
