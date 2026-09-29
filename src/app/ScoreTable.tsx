/** The 凸別点数 table: one row per card, thumbnail with the name on hover, five 凸 columns with a breakdown on hover. */

import { useEffect, useMemo, useReducer, useState } from "preact/hooks";
import type { Card, Score, Totsu } from "../engine/types.ts";
import { Breakdown } from "./Breakdown.tsx";
import { thumbnailUrl } from "./images.ts";
import { PLAN_COLOR, PLAN_LABEL, RARITY_COLOR, RARITY_LABEL, TYPE_COLOR, TYPE_SHORT } from "./labels.ts";
import { NONE_OPEN, nextOpen, shownCell } from "./open-cell.ts";
import { formatPoints, type Row } from "./rows.ts";
import { TOTSUS, type SortSpec } from "./url-state.ts";

function Thumb({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  return (
    <div class="group relative w-16 h-9 sm:w-24 sm:h-14 shrink-0 rounded overflow-hidden bg-slate-200" title={card.name}>
      {failed ? <div class="w-full h-full p-1 text-[10px] leading-tight text-slate-600 overflow-hidden">{card.name}</div> : <img src={thumbnailUrl(card.assetId)} alt={card.name} loading="lazy" width={96} height={56} class="w-full h-full object-cover" onError={() => setFailed(true)} />}
      <div class="absolute inset-x-0 bottom-0 hidden group-hover:block bg-black/70 text-white text-[10px] leading-tight px-1 py-0.5">{card.name}</div>
      {card.spRate && (
        <span class="absolute top-0 left-0 rounded-br bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white" title="SP発生率+（点数には含めません）" aria-label="SP発生率+（点数には含めません）">
          SP
        </span>
      )}
    </div>
  );
}

function CardCell({ row }: { row: Row }) {
  const { card } = row;
  return (
    <div class="flex items-center gap-1.5 sm:gap-2">
      <span class={`w-1.5 self-stretch rounded ${TYPE_COLOR[card.type]}`} aria-label={card.type} />
      <Thumb card={card} />
      <div class="flex flex-col gap-1 text-[10px] whitespace-nowrap">
        <span class={`px-1.5 py-0.5 rounded font-semibold ${RARITY_COLOR[card.rarity]}`}>{RARITY_LABEL[card.rarity]}</span>
        <span class={`px-1.5 py-0.5 rounded ${PLAN_COLOR[card.plan]}`}>{PLAN_LABEL[card.plan]}</span>
        <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{TYPE_SHORT[card.type]}</span>
        {row.noParameterEffect && <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 whitespace-normal">パラメータ効果なし</span>}
      </div>
    </div>
  );
}

/**
 * A 点数 whose breakdown opens on mouse hover, on a tap or click, and on keyboard focus — one at a time (open-cell.ts).
 * On a phone it is a sheet along the bottom of the screen (a cell-anchored box ran off the left edge); from `sm` up it hangs
 * under the cell and lets the pointer through, so moving down the column opens the next row's instead of sitting on it.
 */
function ScoreCell({ score, highlight, open, send }: { score: Score; highlight: boolean; open: boolean; send: (event: KeyedEvent) => void }) {
  const hover = (on: boolean) => (e: PointerEvent) => e.pointerType === "mouse" && send({ type: "hover", on });
  return (
    <td data-score-cell class={`relative px-1 sm:px-2 py-1 text-right tabular-nums ${highlight ? "font-semibold" : ""}`} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => send({ type: "tap" })}
        onFocus={() => send({ type: "focus", on: true })}
        onBlur={() => send({ type: "focus", on: false })}
        class="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4 outline-none focus:decoration-slate-600"
      >
        {formatPoints(score.total)}
      </button>
      {open && (
        <div class="fixed inset-x-2 bottom-2 z-20 max-h-[60vh] overflow-auto sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:max-h-none sm:overflow-visible sm:pointer-events-none sm:min-w-[22rem] sm:max-w-[90vw] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <Breakdown score={score} />
        </div>
      )}
    </td>
  );
}

function SortHeader({ totsu, sort, onSort }: { totsu: Totsu; sort: SortSpec; onSort: (t: Totsu) => void }) {
  const active = sort.totsu === totsu;
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} class="px-1 sm:px-2 py-2 text-right whitespace-nowrap">
      <button type="button" onClick={() => onSort(totsu)} class={`inline-flex items-center gap-1 ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
        凸{totsu}
        <span aria-hidden="true" class="text-[10px]">
          {active ? (sort.desc ? "▼" : "▲") : "△"}
        </span>
      </button>
    </th>
  );
}

/** The open breakdown's cell key and the sender each cell posts its events to; a tap outside every score, or Escape, closes it. */
function useOpenCell(live: ReadonlySet<string>): { shown: string | null; send: (key: string) => (event: KeyedEvent) => void } {
  const [state, dispatch] = useReducer(nextOpen, NONE_OPEN);
  const anyOpen = state.pinned !== null || state.focused !== null || state.hovered !== null;
  useEffect(() => {
    if (!anyOpen) return undefined;
    const outside = (e: Event): void => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-score-cell]")) dispatch({ type: "outside" });
    };
    const escape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") dispatch({ type: "escape" });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anyOpen]);
  return { shown: shownCell(state, (key) => live.has(key)), send: (key) => (event) => dispatch({ ...event, key }) };
}

type KeyedEvent = { type: "hover" | "focus"; on: boolean } | { type: "tap" };

export function ScoreTable({ rows, sort, onSort }: { rows: readonly Row[]; sort: SortSpec; onSort: (t: Totsu) => void }) {
  const live = useMemo(() => new Set(rows.flatMap((row) => TOTSUS.map((t) => `${row.card.id}:${t}`))), [rows]);
  const { shown, send } = useOpenCell(live);
  return (
    <table class="w-full border-collapse text-xs sm:text-sm">
      <thead class="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.slate.200)]">
        <tr>
          <th scope="col" class="px-1 sm:px-2 py-2 text-left font-medium text-slate-500">
            サポートカード <span class="text-xs">({rows.length})</span>
          </th>
          {TOTSUS.map((t) => (
            <SortHeader key={t} totsu={t} sort={sort} onSort={onSort} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.card.id} class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-1 sm:px-2 py-1">
              <CardCell row={row} />
            </td>
            {TOTSUS.map((t) => {
              const key = `${row.card.id}:${t}`;
              return <ScoreCell key={t} score={row.scores[t]} highlight={t === sort.totsu} open={shown === key} send={send(key)} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
