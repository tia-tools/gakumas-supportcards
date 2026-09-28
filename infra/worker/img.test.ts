import { describe, expect, test } from "bun:test";
import { IMMUTABLE, imageKey, serveImage, type ImageBucket } from "./img.ts";

const FILE = "img_general_csprt-3-0016_full.webp";
const KEY = `w192/${FILE}`;
const URL_OK = `https://gakumas-supportcards.tia.run/img/${KEY}`;

function bucket(stored: Record<string, string>): ImageBucket & { calls: string[] } {
  const calls: string[] = [];
  const meta = (key: string) => (key in stored ? { httpEtag: `"etag-${key}"`, size: (stored[key] ?? "").length } : null);
  return {
    calls,
    head: async (key) => (calls.push(`head ${key}`), meta(key)),
    get: async (key) => {
      calls.push(`get ${key}`);
      const m = meta(key);
      const body = new Response(stored[key]).body;
      return m && body ? { ...m, body } : null;
    },
  };
}

const ICON = "img_general_pitem_2-004.webp";
const ICON_KEY = `w48/${ICON}`;

describe("imageKey", () => {
  test("accepts only full card art in the game's naming", () => {
    expect(imageKey(`/img/${KEY}`)).toBe(KEY);
    for (const path of ["/img/", "/img/../secret", `/img/${KEY}/x`, `/img/x/${KEY}`, `/img/${FILE}`, `/img/master/${FILE}`, `/img/w384/${FILE}`, "/img/w192/img_general_csprt-3-016_full.webp", "/img/w192/img_general_cidol-hski-3-000_1-full.webp", `/img/${KEY}?x`, `/${KEY}`, "/img/w192/img_general_csprt-3-0016_full.png"]) {
      expect(imageKey(path)).toBeNull();
    }
  });

  test("accepts P-item icons under w48/ only, in their own naming, and never a card there or an icon under w192/", () => {
    expect(imageKey(`/img/${ICON_KEY}`)).toBe(ICON_KEY);
    for (const path of [`/img/w192/${ICON}`, `/img/w48/${FILE}`, `/img/master/${ICON}`, "/img/w48/img_general_pitem_2-04.webp", "/img/w48/img_general_pitem_2-004_full.webp", "/img/w48/img_general_pitem_2-004.png"]) {
      expect(imageKey(path)).toBeNull();
    }
  });
});

describe("serveImage", () => {
  test("GET serves the object as immutable webp", async () => {
    const b = bucket({ [KEY]: "webp-bytes" });
    const res = await serveImage(new Request(URL_OK), b);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(IMMUTABLE);
    expect(res.headers.get("ETag")).toBe(`"etag-${KEY}"`);
    expect(await res.text()).toBe("webp-bytes");
    expect(b.calls).toEqual([`get ${KEY}`]);
  });

  test("HEAD answers from metadata without reading the body", async () => {
    const b = bucket({ [KEY]: "webp-bytes" });
    const res = await serveImage(new Request(URL_OK, { method: "HEAD" }), b);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Length")).toBe("10");
    expect(b.calls).toEqual([`head ${KEY}`]);
  });

  test("a missing image is a 404 that must not be cached", async () => {
    const res = await serveImage(new Request(URL_OK, { method: "HEAD" }), bucket({}));
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("a path outside the naming scheme never reaches the bucket", async () => {
    const b = bucket({ secret: "x" });
    const res = await serveImage(new Request("https://gakumas-supportcards.tia.run/img/secret"), b);
    expect(res.status).toBe(404);
    expect(b.calls).toEqual([]);
  });

  test("a master is never served, even though it is in the bucket", async () => {
    const b = bucket({ [`master/${FILE}`]: "lossless-original", [KEY]: "thumb" });
    for (const method of ["GET", "HEAD"]) {
      const res = await serveImage(new Request(`https://gakumas-supportcards.tia.run/img/master/${FILE}`, { method }), b);
      expect(res.status).toBe(404);
    }
    expect(b.calls).toEqual([]);
  });

  test("a matching If-None-Match is a 304", async () => {
    const res = await serveImage(new Request(URL_OK, { headers: { "If-None-Match": `"etag-${KEY}"` } }), bucket({ [KEY]: "x" }));
    expect(res.status).toBe(304);
    expect(res.headers.get("Cache-Control")).toBe(IMMUTABLE);
  });

  test("other methods are refused", async () => {
    const res = await serveImage(new Request(URL_OK, { method: "POST" }), bucket({ [KEY]: "x" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});
