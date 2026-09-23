/**
 * `POST /feedback`: the page's feedback form → an issue in the private `tia-tools/feedback`
 * repository, labelled `gakumas-supportcards` and with its category (first plan, decisions D7
 * and D42). The same shape as the rehearsal-automation Worker's handler, which set the tia-tools
 * convention.
 *
 * The endpoint is public by necessity (a secret in the page would be readable by anyone), so it
 * is bounded three ways: a request size cap, a per-day count per client, and a GitHub token that
 * can only write issues on that one repository (fine-grained PAT, Worker secret `FEEDBACK_TOKEN`),
 * so the worst case of any abuse or leak is issue spam in a private repository.
 *
 * The per-day count is kept in KV under a truncated SHA-256 of client IP, UTC date and a secret
 * salt (`HASH_SALT`): no raw IP is stored, the key rotates every day so days cannot be linked,
 * and it expires after two days. KV is eventually consistent, so a burst can slip a few past
 * the limit; the issues-only token bounds what that costs.
 *
 * Everything the handler touches is passed in (`FeedbackDeps`), so `bun test` runs it with a
 * fake store and a fake GitHub.
 */

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_COMMIT_PATTERN,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_VIEW_PATTERN,
  type FeedbackCategory,
  type FeedbackPayload,
} from "./feedback-contract.ts";

export const FEEDBACK_REPO = "tia-tools/feedback";
export const APP_LABEL = "gakumas-supportcards";
export const SITE = "https://gakumas-supportcards.tia.run";
/** Request body cap in bytes; a full message plus the view string is far below it. */
export const BODY_MAX = 20000;
/** Issues one client may create per UTC day. */
export const PER_DAY = 5;
/** Rate-limit keys outlive their day by one day, then expire by themselves. */
const RATE_TTL_SECONDS = 172800;

/** The slice of Cloudflare's KVNamespace this handler uses. */
export interface CountStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export interface NewIssue {
  title: string;
  body: string;
  labels: string[];
}

export interface FeedbackDeps {
  store: CountStore;
  /** Absent until the secret is set; the handler then refuses rather than half-working. */
  salt: string | undefined;
  token: string | undefined;
  /** Creates the issue; returns the HTTP status GitHub answered with. */
  createIssue: (issue: NewIssue, token: string) => Promise<number>;
  now: () => Date;
}

function answer(status: number): Response {
  return new Response(JSON.stringify({ ok: status === 200 }) + "\n", {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && Object.hasOwn(FEEDBACK_CATEGORIES, value);
}

/** The payload, or null when any field is missing, of the wrong type or outside its limits. */
export function parsePayload(raw: string): FeedbackPayload | null {
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof p !== "object" || p === null) return null;
  const { category, message, view, commit } = p as Record<string, unknown>;
  if (!isCategory(category)) return null;
  if (typeof message !== "string" || typeof view !== "string" || typeof commit !== "string") return null;
  const trimmed = message.trim();
  if (trimmed === "" || trimmed.length > FEEDBACK_MESSAGE_MAX) return null;
  if (!FEEDBACK_VIEW_PATTERN.test(view) || !FEEDBACK_COMMIT_PATTERN.test(commit)) return null;
  return { category, message: trimmed, view, commit };
}

/**
 * The message as a fenced code block, so an anonymous sender's text shows as written and
 * cannot render links or images or @mention anyone under the token owner's name. The fence is
 * one backtick longer than the longest backtick run in the message, so nothing inside closes it.
 */
export function fenced(message: string): string {
  const longest = Math.max(0, ...(message.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${message}\n${fence}`;
}

/**
 * Title `[カテゴリ] first line of the message` (GitHub renders no mentions or links in titles),
 * body = the fenced message plus the view and build it was sent from.
 */
export function composeIssue(p: FeedbackPayload): NewIssue {
  const firstLine = (p.message.split(/\r?\n/)[0] ?? "").slice(0, 50);
  const viewLine = p.view === "" ? `${SITE}/ (既定の表示)` : `${SITE}/${p.view}`;
  const body = `${fenced(p.message)}\n\n---\n**表示:** ${viewLine}\n**ビルド:** \`${p.commit}\`\n`;
  return { title: `[${FEEDBACK_CATEGORIES[p.category]}] ${firstLine}`, body, labels: [APP_LABEL, p.category] };
}

/** Truncated SHA-256 of `ip|day|salt` as 16 hex digits: a per-day key that reveals no IP. */
export async function dailyBucket(ip: string, day: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|${salt}`));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The body as text, or null once it passes `max` bytes. Counted in bytes as it streams, so a
 * body without Content-Length (or with a false one) is cut off at the cap instead of being
 * buffered whole, and multibyte text cannot exceed the cap by being short in characters.
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (!(declared <= max)) return null; // also refuses a Content-Length that is not a number
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function handleFeedback(request: Request, deps: FeedbackDeps): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed\n", { status: 405, headers: { Allow: "POST" } });
  }
  const raw = await readCapped(request, BODY_MAX);
  if (raw === null) return answer(413);
  const payload = parsePayload(raw);
  if (payload === null) return answer(400);

  // Without the salt the daily key of an IPv4 address could be brute-forced, so no salt, no store.
  if (!deps.salt || !deps.token) return answer(503);
  // Cloudflare sets this on every request from outside; without it all such requests would share one quota.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return answer(400);
  const day = deps.now().toISOString().slice(0, 10);
  const bucket = await dailyBucket(ip, day, deps.salt);
  const rateKey = `fb/${day}/${bucket}`;
  const sent = Number((await deps.store.get(rateKey)) ?? 0);
  if (sent >= PER_DAY) return answer(429);

  const status = await deps.createIssue(composeIssue(payload), deps.token);
  if (status !== 201) return answer(502);
  // Counted only once GitHub has accepted the issue, so its failures never use up a client's quota.
  await deps.store.put(rateKey, String(sent + 1), { expirationTtl: RATE_TTL_SECONDS });
  return answer(200);
}

/** The real `createIssue`: GitHub's REST API, which rejects requests without a User-Agent. */
export async function createGitHubIssue(issue: NewIssue, token: string): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/issues`, {
    method: "POST",
    headers: {
      "User-Agent": "gakumas-supportcards.tia.run-worker",
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(issue),
  });
  return res.status;
}
