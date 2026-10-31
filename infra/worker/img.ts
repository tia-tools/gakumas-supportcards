/**
 * `/img/*`: the owned image library, read from R2 (docs/adr/0003). Pure request → response
 * over a bucket passed in, so it runs under `bun test` with a fake bucket. The bucket type is
 * the slice of Cloudflare's R2Bucket this handler uses, which keeps the Workers type package
 * out of the project.
 */

export interface StoredImage {
  httpEtag: string;
  size: number;
}
export interface StoredImageBody extends StoredImage {
  body: ReadableStream;
}
export interface ImageBucket {
  head(key: string): Promise<StoredImage | null>;
  get(key: string): Promise<StoredImageBody | null>;
}

/**
 * Only the public renditions are ever looked up, each under its own prefix with the game's own
 * file names: card thumbnails under `w192/` (`img_general_{assetId}_full.webp`), P-item icons under
 * `w48/` (`img_general_pitem_{r}-{nnn}.webp`; Milestone 4 of docs/plans/EXECPLAN_SCORE_ADJUSTMENTS.md),
 * skill card icons under `w112/` (`img_general_skillcard_{kind}-{n}_{nnn}.webp`, with `-{idol id}`
 * for a per-idol variant), and the skill card sprite sheets under `sheet112/`
 * (`{plan}-{idol id}-{8 hex digits of the sheet's SHA-256}.webp`) with their index
 * `sheet112/index.v1.json` (docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md, for gkms-memomemo;
 * this site serves them so that the upload can ask what is stored). The lossless originals sit in
 * the same bucket under `master/` and are deliberately unreachable from the web (plan decision D35).
 */
const IMAGE_PATHS: readonly RegExp[] = [
  /^\/img\/(w192\/img_general_csprt-\d-\d{4}_full\.webp)$/,
  /^\/img\/(w48\/img_general_pitem_\d-\d{3}\.webp)$/,
  /^\/img\/(w112\/img_general_skillcard_(?:act|men|ido)-\d+_\d{3}\.webp)$/,
  /^\/img\/(w112\/img_general_skillcard_(?:act|men|ido)-\d+_\d{3}-[a-z0-9]{4}\.webp)$/,
  /^\/img\/(sheet112\/(?:sense|logic|anomaly)-[a-z0-9]{4}-[0-9a-f]{8}\.webp)$/,
  /^\/img\/(sheet112\/index\.v1\.json)$/,
];

/** The sprite sheets' index: the one library file that changes under its name. */
export const SHEET_INDEX_KEY = "sheet112/index.v1.json";

/** Filenames never change meaning, so a served image is cacheable forever. */
export const IMMUTABLE = "public, max-age=31536000, immutable";
/**
 * The sheet index is rewritten whenever a sheet changes, and the upload reads it through this
 * route to plan, so every use revalidates (decision K14 of the plan above).
 */
export const REVALIDATE = "no-cache";

/** The bucket key for a request path, or null when the path is not a library file. */
export function imageKey(pathname: string): string | null {
  for (const pattern of IMAGE_PATHS) {
    const key = pattern.exec(pathname)?.[1];
    if (key !== undefined) return key;
  }
  return null;
}

/** The Content-Type a library file is served with. */
export function contentTypeFor(key: string): string {
  return key === SHEET_INDEX_KEY ? "application/json" : "image/webp";
}

function cacheControlFor(key: string): string {
  return key === SHEET_INDEX_KEY ? REVALIDATE : IMMUTABLE;
}

/**
 * A miss is never cached: the uploader asks this route which images are missing
 * (scripts/images/upload.py), and a cached 404 would hide an image uploaded a moment later.
 */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function imageHeaders(key: string, image: StoredImage): Headers {
  return new Headers({ "Content-Type": contentTypeFor(key), "Cache-Control": cacheControlFor(key), ETag: image.httpEtag });
}

export async function serveImage(request: Request, bucket: ImageBucket): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const key = imageKey(new URL(request.url).pathname);
  if (key === null) return notFound();

  if (request.method === "HEAD") {
    const meta = await bucket.head(key);
    if (meta === null) return notFound();
    const headers = imageHeaders(key, meta);
    headers.set("Content-Length", String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(key);
  if (object === null) return notFound();
  const headers = imageHeaders(key, object);
  if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(object.body, { status: 200, headers });
}
