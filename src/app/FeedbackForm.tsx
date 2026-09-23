/**
 * Folded 「フィードバックを送る」 form → `POST /feedback` → an issue in the private
 * `tia-tools/feedback` repository (first plan, Milestone 6, decisions D7 and D42). The current
 * view and build are attached and shown before sending. Rules live in ./feedback.ts.
 */

import { useState } from "preact/hooks";
import { FEEDBACK_CATEGORIES, FEEDBACK_MESSAGE_MAX, type FeedbackCategory } from "../../infra/worker/feedback-contract.ts";
import { buildPayload, resultText, viewToAttach } from "./feedback.ts";

type Phase = { kind: "editing" } | { kind: "sending" } | { kind: "done"; status: number };

const CATEGORY_KEYS = Object.keys(FEEDBACK_CATEGORIES) as FeedbackCategory[];

async function send(body: string): Promise<number> {
  try {
    const res = await fetch("/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    return res.status;
  } catch {
    return 0;
  }
}

export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });

  const search = window.location.search;
  const payload = buildPayload(category, message, search, __BUILD_COMMIT__);
  const view = viewToAttach(search);

  const onSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (payload === null) return;
    setPhase({ kind: "sending" });
    const status = await send(JSON.stringify(payload));
    setPhase({ kind: "done", status });
    if (status === 200) setMessage("");
  };

  return (
    <details class="rounded-lg border border-slate-200 bg-white">
      <summary class="cursor-pointer select-none px-3 py-2 text-sm font-medium">フィードバックを送る</summary>
      <form class="flex flex-col gap-2 border-t border-slate-200 p-3" onSubmit={onSubmit}>
        <fieldset class="flex flex-wrap items-center gap-1">
          <legend class="sr-only">種類</legend>
          {CATEGORY_KEYS.map((key) => {
            const on = key === category;
            return (
              <button key={key} type="button" aria-pressed={on} onClick={() => setCategory(key)} class={`px-2 py-0.5 rounded-full text-xs border transition ${on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"}`}>
                {FEEDBACK_CATEGORIES[key]}
              </button>
            );
          })}
        </fieldset>
        <textarea
          value={message}
          maxLength={FEEDBACK_MESSAGE_MAX}
          rows={4}
          placeholder="気づいたこと、おかしな点数、欲しい機能など"
          onInput={(e) => setMessage(e.currentTarget.value)}
          class="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <p class="text-[11px] text-slate-500">
          表示中の設定（{view === "" ? "既定の表示" : view}）とページの版（{__BUILD_COMMIT__}）が一緒に送られます。返信はできません。
        </p>
        <div class="flex items-center gap-2">
          <button type="submit" disabled={payload === null || phase.kind === "sending"} class="rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-40">
            {phase.kind === "sending" ? "送信中…" : "送信"}
          </button>
          {phase.kind === "done" && <span class={`text-xs ${phase.status === 200 ? "text-emerald-700" : "text-rose-700"}`}>{resultText(phase.status)}</span>}
        </div>
      </form>
    </details>
  );
}
