/**
 * Scenario, route profile and lesson-split selectors plus the type / plan / rarity facet toggles.
 * The whole section sticks to the top (./sticky.ts); on a phone that is close to half of the
 * screen, so a phone-only toggle folds the selector row away, leaving the facets (not in the URL).
 */

import { useState } from "preact/hooks";
import type { CardType, LessonSplit, Plan, Rarity, Scenario, RouteProfile } from "../engine/types.ts";
import { PLAN_LABEL, RARITY_LABEL, TYPE_LABEL, splitLabel } from "./labels.ts";
import { roleLabels } from "./share.ts";
import { ShareSlider } from "./ShareSlider.tsx";
import { CARD_TYPES, PLANS, RARITIES, shareFor, withShare, type ViewState } from "./url-state.ts";
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
      <span class="hidden sm:inline text-xs text-slate-500 mr-1">{label}</span>
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

/** The stats that are メイン and サブ under a fixed preset, in their stat colours, so they need not be read out of the preset's name. */
function SplitRoles({ split }: { split: LessonSplit }) {
  const [main, sub] = roleLabels(split);
  return (
    <span class="flex items-center gap-1 text-xs">
      {[
        { role: "メイン", label: main },
        { role: "サブ", label: sub },
      ].map(({ role, label }) => (
        <span key={role} class={`rounded-full border border-current px-2 py-0.5 font-semibold ${label.ink}`}>
          {role} {label.text}
        </span>
      ))}
    </span>
  );
}

/** The selector row's id, for the fold toggle's aria-controls. */
const SELECTORS_ID = "controls-selectors";

export function Controls({ scenarios, scenario, profile, state, update }: Props) {
  const splitOptions = [{ value: "best", label: "カードごとに最適" }, ...profile.lessonSplits.map((s, i) => ({ value: String(i), label: splitLabel(s) }))];
  const split = state.split === null ? null : (profile.lessonSplits[state.split] ?? null);
  const [folded, setFolded] = useState(false);
  return (
    <div class="flex flex-col gap-2">
      <div id={SELECTORS_ID} class={`${folded ? "hidden sm:flex" : "flex"} flex-wrap items-center gap-4`}>
        {scenarios.length > 1 && <Select label="シナリオ" value={scenario.id} options={scenarios.map((s) => ({ value: s.id, label: s.name }))} onChange={(id) => update({ scenarioId: id, profileId: scenarios.find((s) => s.id === id)?.profiles[0]?.id ?? "", split: null, shares: {}, overrides: {} })} />}
        <Select label="育成ルート" value={profile.id} options={scenario.profiles.map((p) => ({ value: p.id, label: p.name }))} onChange={(id) => update({ profileId: id, split: null })} />
        <span class="flex flex-wrap items-center gap-2">
          <Select label="レッスン配分" value={state.split === null ? "best" : String(state.split)} options={splitOptions} onChange={(v) => update({ split: v === "best" ? null : Number(v) })} />
          {split && <SplitRoles split={split} />}
        </span>
        <ShareSlider
          share={shareFor(state, profile)}
          split={split}
          isDefault={state.shares[profile.id] === undefined}
          onChange={(share) => update({ shares: withShare(state.shares, profile, share) })}
          onReset={() => update({ shares: withShare(state.shares, profile, null) })}
        />
      </div>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Facet label="タイプ" values={CARD_TYPES} selected={state.types} labels={TYPE_LABEL} onToggle={(v: CardType) => update({ types: toggle(state.types, v) })} />
        <Facet label="プラン" values={PLANS} selected={state.plans} labels={PLAN_LABEL} onToggle={(v: Plan) => update({ plans: toggle(state.plans, v) })} />
        <Facet label="レアリティ" values={RARITIES} selected={state.rarities} labels={RARITY_LABEL} onToggle={(v: Rarity) => update({ rarities: toggle(state.rarities, v) })} />
        <button
          type="button"
          aria-pressed={state.sp}
          title="SP発生率+のスキルを持つカードだけを表示（点数には含めません）"
          onClick={() => update({ sp: !state.sp })}
          class={`px-2 py-0.5 rounded-full text-xs border transition ${state.sp ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"}`}
        >
          SP発生率+
        </button>
        <button type="button" aria-expanded={!folded} aria-controls={SELECTORS_ID} data-controls-fold onClick={() => setFolded(!folded)} class="sm:hidden ml-auto px-2 py-0.5 rounded-full text-xs border border-slate-300 bg-slate-50 text-slate-600">
          {folded ? "ルート・配分 ▼" : "たたむ ▲"}
        </button>
      </div>
    </div>
  );
}
