/**
 * The 「Pアイテム」 panel, its own folded panel below 「カウントを調整」 (decisions
 * A9, A11, A24 and A26 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md): one row per
 * P-item of a card in view — icon and name (a hint shows the granting card with
 * its thumbnail), the trigger in words, a cap on its fires bounded by the
 * computed count, and for a drink item a toggle that puts it in the deck (its hint
 * carries the arithmetic). The explanation sits behind an `i` mark. Renders the
 * rows of ./item-panel.ts and holds no rule itself; the caps and ticks live in
 * the same overrides as the counts (URL keys `i.` and `d.`).
 */

import { useState } from "preact/hooks";
import { Hint } from "./Hint.tsx";
import { triggerLabel } from "./count-labels.ts";
import { itemIconUrl, thumbnailUrl } from "./images.ts";
import { deckKey, isItemKey, itemCapKey, type ItemRow } from "./item-panel.ts";
import { TYPE_COLOR } from "./labels.ts";
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

/** The granting card, as the table shows it: type bar, thumbnail, name. */
function CardHint({ row }: { row: ItemRow }) {
  const [failed, setFailed] = useState(false);
  return (
    <span class="flex items-center gap-2">
      <span class={`w-1.5 self-stretch rounded ${TYPE_COLOR[row.cardType]}`} aria-hidden="true" />
      {!failed && <img src={thumbnailUrl(row.cardAssetId)} alt="" width={96} height={54} class="h-[54px] w-24 shrink-0 rounded bg-slate-200 object-cover" onError={() => setFailed(true)} />}
      <span class="font-medium">{row.cardName}</span>
    </span>
  );
}

const EXPLANATION = (
  <span class="block space-y-1">
    <span class="block">表示中のカードが持つPアイテムです。</span>
    <span class="block">発動回数は上限として下げられます。既定は選択中のレッスン配分での発動回数（「カードごとに最適」ではそのアイテムに最も有利な配分）。</span>
    <span class="block">🥤 を押すとドリンクを配るアイテムがデッキに入り、配るドリンクが「カウントを調整」のPドリンク獲得回数に加算されて、全カードのPドリンク獲得時スキルに効きます。</span>
  </span>
);

/** The cap on the item's fires; a row that cannot fire under the selected split shows a static 0 whose hint says why (no input: nothing could be typed into it). */
function CountInput({ row, onCap }: { row: ItemRow; onCap: (row: ItemRow, raw: string) => void }) {
  if (row.computed === 0) {
    return (
      <span class="flex items-center gap-1 tabular-nums">
        <Hint hint="このレッスン配分では発動しません" label={`${row.itemName}が発動しない理由`}>
          <span class="inline-block w-14 rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-right text-slate-400">0</span>
        </Hint>
        <span class="w-8 text-[10px] text-slate-300">/ 0</span>
      </span>
    );
  }
  return (
    <span class="flex items-center gap-1 tabular-nums">
      {row.overridden && <span class="text-[10px] text-slate-400">既定 {row.computed}</span>}
      <input type="number" min={0} max={row.computed} step={1} value={row.value} aria-label={`${row.itemName}の発動回数`} onInput={(e) => onCap(row, e.currentTarget.value)} class={`w-14 rounded border px-1 py-0.5 text-right ${row.overridden ? "border-amber-400 bg-amber-50" : "border-slate-300"}`} />
      <span class="w-8 text-[10px] text-slate-400">/ {row.computed}</span>
    </span>
  );
}

function DeckToggle({ row, onDeck }: { row: ItemRow; onDeck: (row: ItemRow, inDeck: boolean) => void }) {
  const drinks = row.drinks;
  if (!drinks) return <span class="h-7 w-7" aria-hidden="true" />;
  const on = drinks.inDeck;
  const total = drinks.perFire * drinks.fires;
  return (
    <Hint hint={`デッキに入れる — ${drinks.perFire}本 × ${drinks.fires}回 = ${total}本${on ? "（加算中）" : ""}`} trigger="wrap">
      {(describedBy) => (
        <button type="button" aria-pressed={on} aria-label={`デッキに入れる（${total}本）`} aria-describedby={describedBy} onClick={() => onDeck(row, !on)} class={`h-7 w-7 rounded border text-sm leading-none transition ${on ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-slate-400 hover:border-slate-500"}`}>
          🥤
        </button>
      )}
    </Hint>
  );
}

/** One row: the item (its hint names the card), the trigger in words, the cap, the deck toggle. */
function ItemRowView({ row, onCap, onDeck }: { row: ItemRow; onCap: (row: ItemRow, raw: string) => void; onDeck: (row: ItemRow, inDeck: boolean) => void }) {
  const idle = row.computed === 0;
  const nameClass = row.overridden ? "font-semibold text-amber-800" : idle ? "text-slate-400" : "text-slate-700";
  return (
    <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 py-1 text-xs">
      <span class="min-w-0">
        <Hint hint={<CardHint row={row} />} label={`${row.itemName}を持つカード`} class="max-w-full">
          <ItemIcon assetId={row.assetId} />
          <span class={`truncate ${nameClass}`}>{row.itemName}</span>
        </Hint>
        <span class={`block text-[10px] leading-snug ${idle ? "text-slate-300" : "text-slate-400"}`}>
          {row.trigger ? triggerLabel(row.trigger) : ""}
          {row.cap !== undefined && ` · 上限${row.cap}回`}
        </span>
      </span>
      <CountInput row={row} onCap={onCap} />
      <DeckToggle row={row} onDeck={onDeck} />
    </div>
  );
}

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
        <div class="mb-1 flex items-center gap-2 text-xs text-slate-500">
          <Hint hint={EXPLANATION} label="Pアイテムの説明">
            <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-semibold text-slate-500">i</span>
          </Hint>
          {changed > 0 && (
            <button type="button" onClick={reset} class="underline text-slate-700">
              既定に戻す
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p class="text-xs text-slate-500">表示中のカードにPアイテムはありません。</p>
        ) : (
          <div class="grid gap-x-8 sm:grid-cols-2">
            {items.map((row) => (
              <ItemRowView key={row.itemId} row={row} onCap={onCap} onDeck={onDeck} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
