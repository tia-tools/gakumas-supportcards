/**
 * 「閉じる」 at the bottom of an open panel: on a phone a panel runs long and its
 * summary line is far above, so it can be folded from where the reading ends. It
 * folds the `<details>` it sits in and brings that panel's summary back into view,
 * clear of the sticky controls (the details carries CLEAR_CONTROLS of ./sticky.ts),
 * rather than leaving the reader wherever the page lands.
 */

export function FoldButton() {
  const onClick = (e: Event): void => {
    const details = e.currentTarget instanceof Element ? e.currentTarget.closest("details") : null;
    if (!details) return;
    details.open = false;
    details.scrollIntoView({ block: "nearest" });
  };
  return (
    <div class="mt-2 flex justify-center">
      <button type="button" onClick={onClick} class="rounded-full border border-slate-300 px-4 py-1 text-xs text-slate-700 hover:border-slate-500">
        閉じる ▲
      </button>
    </div>
  );
}
