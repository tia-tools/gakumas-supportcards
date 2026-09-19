/** Folded 「カウントを調整」 panel: per-category route-count overrides kept in the URL (plan decision D2). */

import type { RouteProfile, TaxonomyRow } from "../engine/types.ts";

interface Props {
  profile: RouteProfile;
  taxonomy: readonly TaxonomyRow[];
  overrides: Readonly<Record<string, number>>;
  onChange: (overrides: Record<string, number>) => void;
}

/** The categories the profile counts, in the game's display order. */
export function countedCategories(profile: RouteProfile, taxonomy: readonly TaxonomyRow[]): TaxonomyRow[] {
  return taxonomy.filter((row) => row.id in profile.counts).sort((a, b) => a.order - b.order);
}

export function CustomizePanel({ profile, taxonomy, overrides, onChange }: Props) {
  const rows = countedCategories(profile, taxonomy);
  const changed = Object.keys(overrides).length;
  const setCount = (id: string, raw: string): void => {
    const next: Record<string, number> = { ...overrides };
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0 || n === profile.counts[id]) delete next[id];
    else next[id] = n;
    onChange(next);
  };
  return (
    <details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        カウントを調整
        {changed > 0 && <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{changed}件変更中</span>}
      </summary>
      <div class="border-t border-slate-200 px-3 py-2 text-sm">
        <p class="mb-2 text-xs text-slate-500">
          「{profile.name}」で各効果が1回のプロデュース中に発動する回数。レッスン終了時の効果はこの回数とレッスン配分の小さい方まで、スキル自体の回数上限があればそこまで発動します。
          {changed > 0 && (
            <button type="button" onClick={() => onChange({})} class="ml-2 underline text-slate-700">
              既定に戻す
            </button>
          )}
        </p>
        <div class="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const base = profile.counts[row.id] ?? 0;
            const value = overrides[row.id] ?? base;
            const overridden = row.id in overrides;
            return (
              <label key={row.id} class="flex items-center justify-between gap-2">
                <span class={`truncate text-xs ${overridden ? "font-semibold text-amber-800" : "text-slate-700"}`} title={row.title}>
                  {row.title}
                </span>
                <span class="flex items-center gap-1 shrink-0">
                  <input type="number" min={0} step={1} value={value} onInput={(e) => setCount(row.id, e.currentTarget.value)} class={`w-16 rounded border px-1 py-0.5 text-right text-xs tabular-nums ${overridden ? "border-amber-400 bg-amber-50" : "border-slate-300"}`} />
                  {overridden && <span class="text-[10px] text-slate-400">既定 {base}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}
