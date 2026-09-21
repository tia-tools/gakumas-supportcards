/**
 * Folded 「カウントを調整」 panel: what happens how often in a run, in four fixed
 * sections, each filter and condition nested under what it narrows and bounded
 * by it; inputs no card in view reacts to are folded into one line per section
 * (docs/plans/EXECPLAN_COUNTING_MODEL.md, decision C6). Overrides live in the URL
 * (plan decision D2). Renders `buildPanel` of ./panel.ts and holds no rule itself.
 */

import type { Overrides, PanelInput, PanelSection } from "./panel.ts";

interface Props {
  profileName: string;
  sections: readonly PanelSection[];
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

export function CustomizePanel({ profileName, sections, overrides, onChange }: Props) {
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
  return (
    <details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        カウントを調整
        {changed > 0 && <span class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{changed}件変更中</span>}
      </summary>
      <div class="border-t border-slate-200 px-3 py-2 text-sm">
        <p class="mb-2 text-xs text-slate-500">
          「{profileName}」で1回のプロデュース中に何が何回起きるか。字下げされた項目は上の項目のうち何回が当てはまるかで、上の回数を超えられません。条件（○○以上の場合 など）は既定では毎回成立とみなします。スキル自体に回数上限があればそこまで発動します。
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
      </div>
    </details>
  );
}
