/**
 * Thumbnail URLs: the owned image library served by this app's Worker under `/img/*`
 * (docs/adr/0003). `w192/` is the 192 x 108 rendition, the only one that is public.
 */

export const IMG_PREFIX = "/img/";

export function thumbnailUrl(assetId: string): string {
  return `${IMG_PREFIX}w192/img_general_${assetId}_full.webp`;
}
