/** The breakdown shown when hovering a 点数: one line per effect, from `Score.lines` (no second computation). */

import type { BreakdownLine, Score } from "../engine/types.ts";
import { formatPoints } from "./rows.ts";
import { routeCountPart, triggerLabel } from "./count-labels.ts";
import { STAT_SHORT, STAT_TEXT, splitLabel } from "./labels.ts";

const KIND_LABEL: Readonly<Record<BreakdownLine["kind"], string>> = { skill: "スキル", event: "イベント", item: "Pアイテム", bonus: "ボーナス" };

/** What the line is a reward for: the card's own event, the run-long bonus, the starting parameters, or a trigger in words. */
function title(line: BreakdownLine): string {
  if (line.kind === "event") return "サポートイベント";
  if (line.kind === "bonus") return "パラメータボーナス";
  if (!line.trigger) return "";
  return line.trigger.occasion === "ProduceStart" ? "初期パラメータ" : triggerLabel(line.trigger);
}

function factor(line: BreakdownLine): string {
  switch (line.kind) {
    case "event":
      return `${line.value} × ${line.count / 1000}`;
    case "bonus":
      return `${line.value / 10}% × ${line.count}`;
    default:
      return `${line.value} × ${line.count}回`;
  }
}

/** Under a line the route leaves at 0回: which part of its trigger the route counts 0 (user, 2026-10-05); the line above words the whole trigger. */
function ZeroNote({ line }: { line: BreakdownLine }) {
  if (!line.zeroBy) return null;
  return <div class="text-amber-700">{line.zeroBy.map((r) => `「${routeCountPart(r)}」`).join("")}がこのルートでは0回</div>;
}

export const ZERO_FOOTNOTE = "0回の効果は点数に入りません。回数は「カウントを調整」で変えられます";

export function Breakdown({ score }: { score: Score }) {
  const { lessons, byStat, share } = score;
  const zeroed = score.lines.some((l) => l.zeroBy);
  return (
    <div class="text-xs text-left leading-snug">
      <div class="flex flex-wrap justify-between gap-x-4 border-b border-slate-200 pb-1 mb-1">
        <span>
          レッスン配分 {splitLabel(lessons)}
          <span class="ml-2 whitespace-nowrap text-slate-500">選抜試験 {share.join(":")}</span>
        </span>
        <span class="tabular-nums">
          {(["vocal", "dance", "visual"] as const).map((s) => (
            <span key={s} class={`ml-2 whitespace-nowrap ${STAT_TEXT[s]}`}>
              {STAT_SHORT[s]} {formatPoints(byStat[s])}
            </span>
          ))}
        </span>
      </div>
      {score.lines.length === 0 && <div class="text-slate-500">パラメータ効果なし</div>}
      <table class="w-full">
        <tbody>
          {score.lines.map((line, i) => (
            <tr key={i} class="align-top">
              <td class="pr-2 text-slate-500 whitespace-nowrap">{KIND_LABEL[line.kind]}</td>
              <td class="pr-2">
                {title(line)}
                {line.itemName && <span class="text-slate-500">（{line.itemName}）</span>}
                <ZeroNote line={line} />
              </td>
              <td class={`pr-2 whitespace-nowrap ${STAT_TEXT[line.stat]}`}>{STAT_SHORT[line.stat]}</td>
              <td class="pr-2 whitespace-nowrap tabular-nums text-slate-600">{factor(line)}</td>
              <td class="text-right whitespace-nowrap tabular-nums font-medium">{formatPoints(line.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {zeroed && <div class="mt-1 border-t border-slate-200 pt-1 text-slate-500">{ZERO_FOOTNOTE}</div>}
    </div>
  );
}
