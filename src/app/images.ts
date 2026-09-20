/** Thumbnail URLs: the owned image library served by this app's Worker under `/img/*` (docs/adr/0003). */

export const IMG_PREFIX = "/img/";

export function thumbnailUrl(assetId: string): string {
  return `${IMG_PREFIX}img_general_${assetId}_full.webp`;
}
