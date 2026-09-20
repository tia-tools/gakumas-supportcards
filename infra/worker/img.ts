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

/** Filenames are the game's own (`img_general_{assetId}_full.webp`); nothing else is ever looked up. */
const IMAGE_PATH = /^\/img\/(img_general_csprt-\d-\d{4}_full\.webp)$/;

/** Filenames never change meaning, so a served image is cacheable forever. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

/** The bucket key for a request path, or null when the path is not a library image. */
export function imageKey(pathname: string): string | null {
  return IMAGE_PATH.exec(pathname)?.[1] ?? null;
}

/**
 * A miss is never cached: the uploader asks this route which images are missing
 * (scripts/images/upload.py), and a cached 404 would hide an image uploaded a moment later.
 */
function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function imageHeaders(image: StoredImage): Headers {
  return new Headers({ "Content-Type": "image/webp", "Cache-Control": IMMUTABLE, ETag: image.httpEtag });
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
    const headers = imageHeaders(meta);
    headers.set("Content-Length", String(meta.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await bucket.get(key);
  if (object === null) return notFound();
  const headers = imageHeaders(object);
  if (request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(object.body, { status: 200, headers });
}
