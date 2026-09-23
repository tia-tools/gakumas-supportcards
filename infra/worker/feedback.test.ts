import { describe, expect, test } from "bun:test";
import { FEEDBACK_MESSAGE_MAX, type FeedbackPayload } from "./feedback-contract.ts";
import { APP_LABEL, BODY_MAX, PER_DAY, composeIssue, fenced, dailyBucket, handleFeedback, parsePayload, type CountStore, type FeedbackDeps, type NewIssue } from "./feedback.ts";

const URL_FEEDBACK = "https://gakumas-supportcards.tia.run/feedback";
const NOW = new Date("2026-09-23T12:00:00Z");
const GOOD: FeedbackPayload = { category: "bug", message: "点数がおかしい\n2行目", view: "?p=sashiire&o.lesson=6", commit: "abc1234def56" };

function store(initial: Record<string, string> = {}): CountStore & { data: Record<string, string>; ttls: number[] } {
  const data = { ...initial };
  const ttls: number[] = [];
  return {
    data,
    ttls,
    get: async (key) => data[key] ?? null,
    put: async (key, value, { expirationTtl }) => {
      data[key] = value;
      ttls.push(expirationTtl);
    },
  };
}

function deps(overrides: Partial<FeedbackDeps> = {}, githubStatus = 201): FeedbackDeps & { issues: NewIssue[] } {
  const issues: NewIssue[] = [];
  return {
    issues,
    store: store(),
    salt: "salt",
    token: "token",
    createIssue: async (issue) => (issues.push(issue), githubStatus),
    now: () => NOW,
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_FEEDBACK, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "CF-Connecting-IP": "203.0.113.7", ...headers } });
}

describe("parsePayload", () => {
  test("accepts a real payload and trims the message", () => {
    expect(parsePayload(JSON.stringify({ ...GOOD, message: "  hi  " }))).toEqual({ ...GOOD, message: "hi" });
    expect(parsePayload(JSON.stringify({ ...GOOD, view: "", commit: "unknown" }))).not.toBeNull();
  });

  test("refuses anything outside the contract", () => {
    for (const bad of [
      "not json",
      "null",
      JSON.stringify({ ...GOOD, category: "spam" }),
      JSON.stringify({ ...GOOD, category: "toString" }),
      JSON.stringify({ ...GOOD, message: "   " }),
      JSON.stringify({ ...GOOD, message: "x".repeat(FEEDBACK_MESSAGE_MAX + 1) }),
      JSON.stringify({ ...GOOD, view: "?a=b)[x](https://evil" }),
      JSON.stringify({ ...GOOD, view: "no-question-mark" }),
      JSON.stringify({ ...GOOD, commit: "`; rm" }),
      JSON.stringify({ category: "bug", message: "hi" }),
    ]) {
      expect(parsePayload(bad)).toBeNull();
    }
    expect(parsePayload(JSON.stringify({ ...GOOD, message: "x".repeat(FEEDBACK_MESSAGE_MAX) }))).not.toBeNull();
  });
});

describe("composeIssue", () => {
  test("titles by category and first line, labels with the app and the category, links the view", () => {
    const issue = composeIssue({ category: "request", message: "a".repeat(60) + "\nmore", view: "?t=vocal", commit: "abc1234" });
    expect(issue.title).toBe(`[要望] ${"a".repeat(50)}`);
    expect(issue.labels).toEqual([APP_LABEL, "request"]);
    expect(issue.body).toContain("https://gakumas-supportcards.tia.run/?t=vocal");
    expect(issue.body).toContain("`abc1234`");
  });

  test("the message is fenced, so its Markdown and @mentions do not render", () => {
    const body = composeIssue({ ...GOOD, message: "@octocat ![x](https://evil/x.png) [link](https://evil)" }).body;
    expect(body.startsWith("```text\n@octocat ![x](https://evil/x.png) [link](https://evil)\n```\n")).toBe(true);
  });

  test("no backtick run inside the message can close the fence", () => {
    expect(fenced("a")).toBe("```text\na\n```");
    expect(fenced("x ``` @octocat\n````` y")).toBe("``````text\nx ``` @octocat\n````` y\n``````");
  });

  test("the default view is named as such", () => {
    expect(composeIssue({ ...GOOD, category: "bug", view: "" }).body).toContain("https://gakumas-supportcards.tia.run/ (既定の表示)");
  });
});

describe("dailyBucket", () => {
  test("is stable within a day and differs across days, salts and IPs", async () => {
    const a = await dailyBucket("203.0.113.7", "2026-09-23", "s");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await dailyBucket("203.0.113.7", "2026-09-23", "s")).toBe(a);
    for (const other of [await dailyBucket("203.0.113.7", "2026-09-24", "s"), await dailyBucket("203.0.113.7", "2026-09-23", "t"), await dailyBucket("203.0.113.8", "2026-09-23", "s")]) {
      expect(other).not.toBe(a);
    }
  });
});

describe("handleFeedback", () => {
  test("creates one issue and counts it under today's salted key", async () => {
    const d = deps();
    const res = await handleFeedback(post(GOOD), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(d.issues).toHaveLength(1);
    const key = `fb/2026-09-23/${await dailyBucket("203.0.113.7", "2026-09-23", "salt")}`;
    expect((d.store as ReturnType<typeof store>).data).toEqual({ [key]: "1" });
    expect((d.store as ReturnType<typeof store>).ttls).toEqual([172800]);
  });

  test(`refuses the ${PER_DAY + 1}th issue of a day without calling GitHub`, async () => {
    const key = `fb/2026-09-23/${await dailyBucket("203.0.113.7", "2026-09-23", "salt")}`;
    const d = deps({ store: store({ [key]: String(PER_DAY) }) });
    expect((await handleFeedback(post(GOOD), d)).status).toBe(429);
    expect(d.issues).toHaveLength(0);
    const almost = deps({ store: store({ [key]: String(PER_DAY - 1) }) });
    expect((await handleFeedback(post(GOOD), almost)).status).toBe(200);
  });

  test("a GitHub failure is a 502 and does not use up the quota", async () => {
    const d = deps({}, 403);
    expect((await handleFeedback(post(GOOD), d)).status).toBe(502);
    expect((d.store as ReturnType<typeof store>).data).toEqual({});
  });

  test("refuses to run without its secrets rather than storing unsalted keys", async () => {
    for (const missing of [{ salt: undefined }, { token: undefined }, { salt: "" }]) {
      const d = deps(missing);
      expect((await handleFeedback(post(GOOD), d)).status).toBe(503);
      expect(d.issues).toHaveLength(0);
      expect((d.store as ReturnType<typeof store>).data).toEqual({});
    }
  });

  test("bad input never reaches GitHub", async () => {
    const d = deps();
    expect((await handleFeedback(post({ ...GOOD, category: "spam" }), d)).status).toBe(400);
    expect((await handleFeedback(post("x".repeat(BODY_MAX + 1)), d)).status).toBe(413);
    expect((await handleFeedback(post(GOOD, { "Content-Length": String(BODY_MAX + 1) }), d)).status).toBe(413);
    expect((await handleFeedback(post(GOOD, { "Content-Length": "abc" }), d)).status).toBe(413);
    expect(d.issues).toHaveLength(0);
  });

  test("the body cap counts bytes, not characters", async () => {
    // 7 000 three-byte characters: under the cap in characters, over it in bytes.
    const d = deps();
    const wide = JSON.stringify({ ...GOOD, message: "あ".repeat(7000) });
    expect(wide.length).toBeLessThan(BODY_MAX);
    expect((await handleFeedback(post(wide), d)).status).toBe(413);
    // Streamed without Content-Length, so only the byte count can catch it.
    const bytes = new TextEncoder().encode(wide);
    const streamed = new Request(URL_FEEDBACK, { method: "POST", body: new ReadableStream({ start: (c) => (c.enqueue(bytes), c.close()) }), headers: { "CF-Connecting-IP": "203.0.113.7" } });
    expect(streamed.headers.get("Content-Length")).toBeNull();
    expect((await handleFeedback(streamed, d)).status).toBe(413);
    expect(d.issues).toHaveLength(0);
  });

  test("an endless body is cut off at the cap, not read to the end", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new Uint8Array(1000).fill(0x61);
    const endless = new ReadableStream<Uint8Array>({ pull: (c) => (pulled++, c.enqueue(chunk)), cancel: () => void (cancelled = true) });
    const d = deps();
    const res = await handleFeedback(new Request(URL_FEEDBACK, { method: "POST", body: endless, headers: { "CF-Connecting-IP": "203.0.113.7" } }), d);
    expect(res.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(BODY_MAX / chunk.byteLength + 2);
  });

  test("a request without a client address is refused, not pooled into one shared quota", async () => {
    const d = deps();
    const res = await handleFeedback(new Request(URL_FEEDBACK, { method: "POST", body: JSON.stringify(GOOD) }), d);
    expect(res.status).toBe(400);
    expect(d.issues).toHaveLength(0);
    expect((d.store as ReturnType<typeof store>).data).toEqual({});
  });

  test("only POST", async () => {
    const res = await handleFeedback(new Request(URL_FEEDBACK), deps());
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
