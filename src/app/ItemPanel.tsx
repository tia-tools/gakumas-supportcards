/**
 * The 「Pアイテム」 panel, its own folded panel below 「カウントを調整」 (decisions
 * A9, A11 and A24 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): one row per P-item
 * of a card in view with its icon, a cap on its fires bounded by the computed
 * count, and for a drink item the tick that adds its drinks to the deck. Renders
 * the rows of ./item-panel.ts and holds no rule itself; the caps and ticks live in
 * the same overrides as the counts (URL keys `i.` and `d.`).
 */

import { useState } from "preact/hooks";
import { triggerLabel } from "./count-labels.ts";
import { itemIconUrl } from "./images.ts";
import { deckKey, itemCapKey, type ItemRow } from "./item-panel.ts";
import type { Overrides } from "./panel.ts";

interface Props {
  /** The rows of the cards in view (src/app/item-panel.ts). */
  items: readonly ItemRow[];
  overrides: Overrides;
  onChange: (overrides: Record<string, number>) => void;
}

/** The item's icon from the image library, or nothing when the site does not serve it yet (the name beside it stands alone). */
function ItemIcon({ assetId }: { assetId: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={itemIconUrl(assetId)} alt="" width={24} height={24} loading="lazy" class="h-6 w-6 shrink-0" onError={() => setFailed(true)} />;
}

/** One row: the item with its icon, its card and trigger, a cap on its fires bounded by the computed count, and for a drink item its tick. */
function ItemRowView({ row, onCap, onDeck }: { row: ItemRow; onCap: (row: ItemRow, raw: string) => void; onDeck: (row: ItemRow, inDeck: boolean) => void }) {
  const labelClass = row.overridden ? "font-semibold text-amber-800" : "text-slate-700";
  return (
    <div class="flex items-center justify-between gap-2 py-0.5">
      <ItemIcon assetId={row.assetId} />
      <span class={`min-w-0 flex-1 text-xs ${labelClass}`}>
        <span class="truncate">
          {row.itemName} <span class="text-slate-400">← {row.cardName}</span>
        </span>
        <span class="block truncate text-[10px] text-slate-400">
          {row.trigger ? triggerLabel(row.trigger) : ""}
          {row.cap !== undefined && ` · 上限${row.cap}回`}
        </span>
      </span>
      <span class="flex shrink-0 items-center gap-1 text-xs tabular-nums">
        {row.overridden && <span class="text-[10px] text-slate-400">既定 {row.computed}</span>}
        <input type="number" min={0} max={row.computed} step={1} value={row.value} onInput={(e) => onCap(row, e.currentTarget.value)} class={`w-14 rounded border px-1 py-0.5 text-right ${row.overridden ? "border-amber-400 bg-amber-50" : "border-slate-300"}`} />
        <span class="w-8 text-[10px] text-slate-400">/ {row.computed}</span>
        {row.drinks && (
          <label class="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-600">
            <input type="checkbox" checked={row.drinks.inDeck} onChange={(e) => onDeck(row, e.currentTarget.checked)} />
            デッキに入れる
            <span class={row.drinks.inDeck ? "text-sky-700" : "text-slate-400"}>
              {row.drinks.perFire}本 × {row.drinks.fires} = {row.drinks.perFire * row.drinks.fires}本
            </span>
          </label>
        )}
      </span>
    </div>
  );
}

const isItemKey = (key: string): boolean => key.startsWith("i.") || key.startsWith("d.");

export function ItemPanel({ items, overrides, onChange }: Props) {
  const changed = Object.keys(overrides).filter(isItemKey).length;
  const onCap = (row: ItemRow, raw: string): void => {
    const next: Record<string, number> = { ...overrides };
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0 || n >= row.computed) delete next[itemCapKey(row.itemId)];
    else next[itemCapKey(row.itemId)] = n;
    onChange(next);
  };
  const onDeck = (row: ItemRow, inDeck: boolean): void => {
    const next: Record<string, number> = { ...overrides };
    if (inDeck) next[deckKey(row.itemId)] = 1;
    else delete next[deckKey(row.itemId)];
    onChange(next);
  };
  const reset = (): void => onChange(Object.fromEntries(Object.entries(overrides).filter(([key]) => !isItemKey(key))));
  return (
    <details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        Pアイテム
        {changed > 0 && <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{changed}件変更中</span>}
      </summary>
      <div class="border-t border-slate-200 px-3 py-2 text-sm">
        <p class="mb-2 text-xs text-slate-500">
          表示中のカードが持つPアイテム。発動回数は上限として下げられます（既定はこのルートでの最大発動回数）。ドリンクを配るPアイテムは「デッキに入れる」にすると、配るドリンクが「カウントを調整」のPドリンク獲得回数に加算され、全カードのPドリンク獲得時スキルに効きます。
          {changed > 0 && (
            <button type="button" onClick={reset} class="ml-2 underline text-slate-700">
              既定に戻す
            </button>
          )}
        </p>
        {items.length === 0 ? (
          <p class="text-xs text-slate-500">表示中のカードにPアイテムはありません。</p>
        ) : (
          <div class="grid gap-x-6 sm:grid-cols-2">
            {items.map((row) => (
              <ItemRowView key={row.itemId} row={row} onCap={onCap} onDeck={onDeck} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
