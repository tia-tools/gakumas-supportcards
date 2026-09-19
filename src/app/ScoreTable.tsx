/** The 凸別点数 table: one row per card, thumbnail with the name on hover, five 凸 columns with a breakdown on hover. */

import { useState } from "preact/hooks";
import type { Card, Score, Totsu } from "../engine/types.ts";
import { Breakdown } from "./Breakdown.tsx";
import { thumbnailUrl } from "./images.ts";
import { PLAN_COLOR, PLAN_LABEL, RARITY_COLOR, RARITY_LABEL, TYPE_COLOR, TYPE_SHORT } from "./labels.ts";
import { formatPoints, type Row } from "./rows.ts";
import { TOTSUS, type SortSpec } from "./url-state.ts";

function Thumb({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  return (
    <div class="group relative w-24 h-14 shrink-0 rounded overflow-hidden bg-slate-200" title={card.name}>
      {failed ? <div class="w-full h-full p-1 text-[10px] leading-tight text-slate-600 overflow-hidden">{card.name}</div> : <img src={thumbnailUrl(card.assetId)} alt={card.name} loading="lazy" width={96} height={56} class="w-full h-full object-cover" onError={() => setFailed(true)} />}
      <div class="absolute inset-x-0 bottom-0 hidden group-hover:block bg-black/70 text-white text-[10px] leading-tight px-1 py-0.5">{card.name}</div>
    </div>
  );
}

function CardCell({ row }: { row: Row }) {
  const { card } = row;
  return (
    <div class="flex items-center gap-2">
      <span class={`w-1.5 self-stretch rounded ${TYPE_COLOR[card.type]}`} aria-label={card.type} />
      <Thumb card={card} />
      <div class="flex flex-col gap-1 text-[10px]">
        <span class={`px-1.5 py-0.5 rounded font-semibold ${RARITY_COLOR[card.rarity]}`}>{RARITY_LABEL[card.rarity]}</span>
        <span class={`px-1.5 py-0.5 rounded ${PLAN_COLOR[card.plan]}`}>{PLAN_LABEL[card.plan]}</span>
        <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{TYPE_SHORT[card.type]}</span>
        {row.noParameterEffect && <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">パラメータ効果なし</span>}
      </div>
    </div>
  );
}

function ScoreCell({ score, highlight }: { score: Score; highlight: boolean }) {
  return (
    <td class={`group relative px-2 py-1 text-right tabular-nums ${highlight ? "font-semibold" : ""}`}>
      <span tabIndex={0} class="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4 outline-none focus:decoration-slate-600">
        {formatPoints(score.total)}
      </span>
      <div class="hidden group-hover:block group-focus-within:block absolute right-0 top-full z-20 min-w-[22rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        <Breakdown score={score} />
      </div>
    </td>
  );
}

function SortHeader({ totsu, sort, onSort }: { totsu: Totsu; sort: SortSpec; onSort: (t: Totsu) => void }) {
  const active = sort.totsu === totsu;
  return (
    <th scope="col" aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} class="px-2 py-2 text-right whitespace-nowrap">
      <button type="button" onClick={() => onSort(totsu)} class={`inline-flex items-center gap-1 ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
        凸{totsu}
        <span aria-hidden="true" class="text-[10px]">
          {active ? (sort.desc ? "▼" : "▲") : "△"}
        </span>
      </button>
    </th>
  );
}

export function ScoreTable({ rows, sort, onSort }: { rows: readonly Row[]; sort: SortSpec; onSort: (t: Totsu) => void }) {
  return (
    <table class="w-full border-collapse text-sm">
      <thead class="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.slate.200)]">
        <tr>
          <th scope="col" class="px-2 py-2 text-left font-medium text-slate-500">
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
            <td class="px-2 py-1">
              <CardCell row={row} />
            </td>
            {TOTSUS.map((t) => (
              <ScoreCell key={t} score={row.scores[t]} highlight={t === sort.totsu} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
