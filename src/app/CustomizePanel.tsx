/**
 * Folded 「カウントを調整」 panel: what happens how often in a run, in four fixed
 * sections, each filter and condition nested under what it narrows and bounded
 * by it; inputs no card in view reacts to are folded into one line per section
 * (docs/plans/EXECPLAN_COUNTING_MODEL.md, decision C6). Overrides live in the URL
 * (plan decision D2). Renders `buildPanel` of ./panel.ts and holds no rule itself.
 */

import { useState } from "preact/hooks";
import { triggerLabel } from "./count-labels.ts";
import { itemIconUrl } from "./images.ts";
import { deckKey, itemCapKey, type ItemRow } from "./item-panel.ts";
import type { Overrides, PanelInput, PanelSection } from "./panel.ts";

interface Props {
  profileName: string;
  sections: readonly PanelSection[];
  /** The 「Pアイテム」 rows of the cards in view (src/app/item-panel.ts). */
  items: readonly ItemRow[];
  overrides: Overrides;
  onChange: (overrides: Record<string, number>) => void;
}

interface RowProps {
  input: PanelInput;
  /** Shown before the label when the row is listed away from its parent. */
  path?: string;
  onCount: (input: PanelInput, raw: string) => void;
}

function Row({ input, path, onCount }: RowProps) {
  const labelClass = input.overridden ? "font-semibold text-amber-800" : input.readOnly ? "text-slate-500" : "text-slate-700";
  return (
    <label class="flex items-center justify-between gap-2 py-0.5" title={input.note}>
      <span class={`truncate text-xs ${labelClass}`}>
        {path && <span class="text-slate-400">{path} › </span>}
        {input.label}
        {input.note && <span class="ml-1 text-[10px] text-sky-700">※</span>}
      </span>
      <span class="flex shrink-0 items-center gap-1 text-xs tabular-nums">
        {input.overridden && <span class="text-[10px] text-slate-400">既定 {input.base}</span>}
        {input.readOnly ? (
          <span class="w-14 px-1 text-right text-slate-500">{input.value}</span>
        ) : (
          <input
            type="number"
            min={0}
            max={input.max ?? undefined}
            step={1}
            value={input.value}
            onInput={(e) => onCount(input, e.currentTarget.value)}
            class={`w-14 rounded border px-1 py-0.5 text-right ${input.overridden ? "border-amber-400 bg-amber-50" : "border-slate-300"}`}
          />
        )}
        <span class="w-8 text-[10px] text-slate-400">{input.max === null ? "回" : `/ ${input.max}`}</span>
      </span>
    </label>
  );
}

/** A used input with its used children nested; unused ones are collected by `foldedOf`. */
function Tree({ input, onCount }: { input: PanelInput; onCount: RowProps["onCount"] }) {
  const children = input.children.filter((c) => c.used);
  return (
    <div>
      <Row input={input} onCount={onCount} />
      {children.length > 0 && (
        <div class="ml-2 border-l border-slate-200 pl-2">
          {children.map((c) => (
            <Tree key={c.key} input={c} onCount={onCount} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Inputs no card in view reacts to, flattened with the path to each. */
function foldedOf(inputs: readonly PanelInput[], path = ""): { input: PanelInput; path: string }[] {
  return inputs.flatMap((i) => [...(i.used ? [] : [{ input: i, path }]), ...foldedOf(i.children, path ? `${path} › ${i.label}` : i.label)]);
}

function Section({ section, onCount }: { section: PanelSection; onCount: RowProps["onCount"] }) {
  const folded = foldedOf(section.inputs);
  const changedInFold = folded.filter((f) => f.input.overridden).length;
  return (
    <section class="rounded border border-slate-200 p-2">
      <h3 class="mb-1 text-xs font-semibold text-slate-600">{section.title}</h3>
      {section.inputs
        .filter((i) => i.used)
        .map((i) => (
          <Tree key={i.key} input={i} onCount={onCount} />
        ))}
      {folded.length > 0 && (
        <details class="mt-1">
          <summary class="cursor-pointer select-none text-[11px] text-slate-500">
            表示中のカードが使わない項目（{folded.length}）{changedInFold > 0 && <span class="ml-1 text-amber-800">{changedInFold}件変更中</span>}
          </summary>
          {folded.map((f) => (
            <Row key={f.input.key} input={f.input} path={f.path} onCount={onCount} />
          ))}
        </details>
      )}
    </section>
  );
}

/** The item's icon from the image library, or nothing when the site does not serve it yet (the name beside it stands alone). */
function ItemIcon({ assetId }: { assetId: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={itemIconUrl(assetId)} alt="" width={24} height={24} loading="lazy" class="h-6 w-6 shrink-0" onError={() => setFailed(true)} />;
}

/** One 「Pアイテム」 row: the item with its icon, its card and trigger, a cap on its fires bounded by the computed count, and for a drink item its tick (decisions A9, A11). */
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

export function CustomizePanel({ profileName, sections, items, overrides, onChange }: Props) {
  const changed = Object.keys(overrides).length;
  const onCount = (input: PanelInput, raw: string): void => {
    const next: Record<string, number> = { ...overrides };
    const n = Number(raw);
    if (raw === "" || !Number.isInteger(n) || n < 0) delete next[input.key];
    else {
      const bounded = input.max === null ? n : Math.min(n, input.max);
      if (bounded === input.base) delete next[input.key];
      else next[input.key] = bounded;
    }
    onChange(next);
  };
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
  return (
    <details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        カウントを調整
        {changed > 0 && <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{changed}件変更中</span>}
      </summary>
      <div class="border-t border-slate-200 px-3 py-2 text-sm">
        <p class="mb-2 text-xs text-slate-500">
          「{profileName}」で1回のプロデュース中に何が何回起きるか。字下げされた項目は上の項目のうち何回が当てはまるかで、上の回数を超えられません。条件（○○以上の場合 など）は既定では毎回成立とみなします。スキル自体に回数上限があればそこまで発動します。「Pアイテム」の発動回数は上限として下げられます。ドリンクを配るPアイテムは「デッキに入れる」にすると、配るドリンクが全カードのPドリンク獲得回数に加算されます。
          {changed > 0 && (
            <button type="button" onClick={() => onChange({})} class="ml-2 underline text-slate-700">
              既定に戻す
            </button>
          )}
        </p>
        <div class="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <Section key={s.id} section={s} onCount={onCount} />
          ))}
        </div>
        {items.length > 0 && (
          <section class="mt-2 rounded border border-slate-200 p-2">
            <h3 class="mb-1 text-xs font-semibold text-slate-600">Pアイテム（表示中のカードが持つもの）</h3>
            <div class="grid gap-x-6 sm:grid-cols-2">
              {items.map((row) => (
                <ItemRowView key={row.itemId} row={row} onCap={onCap} onDeck={onDeck} />
              ))}
            </div>
          </section>
        )}
      </div>
    </details>
  );
}
