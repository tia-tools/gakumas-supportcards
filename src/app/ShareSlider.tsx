/**
 * The 「選抜試験のスコア配分」 control (decision A5 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md):
 * a bar in three segments — main, sub, other — with two thumbs (range inputs laid
 * over the bar, so the keyboard works) and a +/− pair under each segment. Renders
 * the rules of ./share.ts and holds none itself.
 */

import type { AuditionShare, LessonSplit } from "../engine/types.ts";
import { moveThumb, roleLabels, step, type Role } from "./share.ts";

interface Props {
  share: AuditionShare;
  /** The fixed preset, or null under 「カードごとに最適」 (labels by role). */
  split: LessonSplit | null;
  isDefault: boolean;
  onChange: (share: AuditionShare) => void;
  onReset: () => void;
}

const THUMB = "absolute inset-x-0 top-0 h-3 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-700 [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-700 [&::-moz-range-thumb]:bg-white";

export function ShareSlider({ share, split, isDefault, onChange, onReset }: Props) {
  const labels = roleLabels(split);
  const roles: readonly Role[] = [0, 1, 2];
  return (
    <div class="flex flex-col gap-1 text-sm">
      <span class="text-xs text-slate-500">
        選抜試験のスコア配分
        {!isDefault && (
          <button type="button" onClick={onReset} class="ml-2 underline text-slate-700">
            既定に戻す
          </button>
        )}
      </span>
      <div class="relative h-3 w-56">
        <div class="flex h-3 w-full overflow-hidden rounded-full">
          {roles.map((r) => (
            <div key={r} class={`h-full ${labels[r].bar}`} style={{ width: `${share[r] * 10}%` }} />
          ))}
        </div>
        <input type="range" min={0} max={10} step={1} value={share[0]} aria-label={`${labels[0].text}と${labels[1].text}の境界`} onInput={(e) => onChange(moveThumb(share, 0, Number(e.currentTarget.value)))} class={THUMB} />
        <input type="range" min={0} max={10} step={1} value={share[0] + share[1]} aria-label={`${labels[1].text}と${labels[2].text}の境界`} onInput={(e) => onChange(moveThumb(share, 1, Number(e.currentTarget.value)))} class={THUMB} />
      </div>
      <div class="flex w-56 justify-between text-xs tabular-nums">
        {roles.map((r) => (
          <span key={r} class={`flex items-center gap-1 ${labels[r].ink}`}>
            <button type="button" aria-label={`${labels[r].text}を減らす`} onClick={() => onChange(step(share, r, -1))} class="rounded border border-slate-300 px-1 leading-4 text-slate-600 hover:border-slate-500">
              −
            </button>
            {labels[r].text} {share[r]}
            <button type="button" aria-label={`${labels[r].text}を増やす`} onClick={() => onChange(step(share, r, 1))} class="rounded border border-slate-300 px-1 leading-4 text-slate-600 hover:border-slate-500">
              +
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
