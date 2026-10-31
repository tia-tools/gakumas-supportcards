import { describe, expect, test } from "bun:test";
import { IMMUTABLE, REVALIDATE, SHEET_INDEX_KEY, imageKey, serveImage, type ImageBucket } from "./img.ts";

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

const SKILL_ICON = "w112/img_general_skillcard_act-3_029-hski.webp";
const SKILL_SINGLE = "w112/img_general_skillcard_men-0_003.webp";
const SHEET = "sheet112/sense-hski-1a2b3c4d.webp";

describe("imageKey for gkms-memomemo's skill card art", () => {
  test("accepts skill card icons under w112/, single or per idol, the sheets and their index under sheet112/", () => {
    for (const key of [SKILL_ICON, SKILL_SINGLE, "w112/img_general_skillcard_ido-100_039.webp", SHEET, "sheet112/anomaly-hrnm-00ff00ff.webp", SHEET_INDEX_KEY]) {
      expect(imageKey(`/img/${key}`)).toBe(key);
    }
  });

  test("refuses masters, other renditions' names under these prefixes, and near misses", () => {
    for (const path of [
      `/img/master/${SKILL_ICON.slice(5)}`,
      `/img/w192/${SKILL_ICON.slice(5)}`,
      `/img/w112/${FILE}`,
      `/img/w112/${ICON}`,
      "/img/w112/img_general_skillcard_act-3_029-HSKI.webp",
      "/img/w112/img_general_skillcard_act-3_029-hski-ttmr.webp",
      "/img/w112/img_general_skillcard_act-3_29.webp",
      "/img/w112/img_general_skillcard_acc-0_002.webp",
      "/img/sheet112/sense-hski-1a2b3c4.webp",
      "/img/sheet112/sense-hski-1A2B3C4D.webp",
      "/img/sheet112/free-hski-1a2b3c4d.webp",
      "/img/sheet112/sense-hski.webp",
      "/img/sheet112/index.v2.json",
      "/img/sheet112/index.json",
      `/img/w112/${SHEET.slice(9)}`,
      `/img/sheet112/${SKILL_ICON.slice(5)}`,
    ]) {
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

  test("serves a skill card icon and a sheet as immutable webp", async () => {
    for (const key of [SKILL_ICON, SHEET]) {
      const res = await serveImage(new Request(`https://gakumas-supportcards.tia.run/img/${key}`), bucket({ [key]: "webp" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/webp");
      expect(res.headers.get("Cache-Control")).toBe(IMMUTABLE);
    }
  });

  test("serves the sheet index as JSON that every use revalidates, on GET and HEAD", async () => {
    const url = `https://gakumas-supportcards.tia.run/img/${SHEET_INDEX_KEY}`;
    const b = bucket({ [SHEET_INDEX_KEY]: '{"formatVersion":1}' });
    for (const method of ["GET", "HEAD"]) {
      const res = await serveImage(new Request(url, { method }), b);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/json");
      expect(res.headers.get("Cache-Control")).toBe(REVALIDATE);
    }
    expect(await (await serveImage(new Request(url), b)).text()).toBe('{"formatVersion":1}');
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
