/**
 * A count input of the 「カウントを調整」 and 「Pアイテム」 panels: while it has focus it
 * shows what is being typed, an empty field included, and hands on only what
 * `editCount` of ./count-field.ts lets through; leaving it, or the stored count
 * moving away from what was typed, shows the stored count again.
 */

import { useState } from "preact/hooks";
import { editCount } from "./count-field.ts";

interface Props {
  value: number;
  max: number | null;
  overridden: boolean;
  label?: string;
  onCount: (raw: string) => void;
}

export function CountField({ value, max, overridden, label, onCount }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const onInput = (input: HTMLInputElement): void => {
    const edit = editCount(input.value, max);
    if (edit.text !== input.value) input.value = edit.text; // a draft already at the cap would not re-render
    setDraft(edit.text);
    if (edit.commit !== null) onCount(edit.commit);
  };
  // A draft the stored count no longer agrees with (changed from elsewhere, or cut by a lower cap) gives way to it; an empty one is being retyped.
  const shown = draft !== null && (draft === "" || Number(draft) === value) ? draft : value;
  return (
    <input
      type="number"
      min={0}
      max={max ?? undefined}
      step={1}
      value={shown}
      aria-label={label}
      onInput={(e) => onInput(e.currentTarget)}
      onBlur={() => setDraft(null)}
      class={`w-14 rounded border px-1 py-0.5 text-right ${overridden ? "border-amber-400 bg-amber-50" : "border-slate-300"}`}
    />
  );
}
