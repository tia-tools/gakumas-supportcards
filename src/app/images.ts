/**
 * Image URLs: the owned image library served by this app's Worker under `/img/*`
 * (docs/adr/0003). `w192/` is the 192 x 108 card thumbnail and `w48/` the 48 x 48 P-item icon
 * (Milestone 4 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md); the masters are never served.
 */

export const IMG_PREFIX = "/img/";

export function thumbnailUrl(assetId: string): string {
  return `${IMG_PREFIX}w192/img_general_${assetId}_full.webp`;
}

/** `assetId` is the item's own, which already starts with `img_general_` (e.g. `img_general_pitem_2-004`). */
export function itemIconUrl(assetId: string): string {
  return `${IMG_PREFIX}w48/${assetId}.webp`;
}
