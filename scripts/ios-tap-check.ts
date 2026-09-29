/**
 * Real-touch check of the score table's breakdown in Safari on the iOS Simulator.
 *
 *   bun scripts/ios-tap-check.ts [--udid <simulator udid>] [--port <n>]
 *
 * Starts its own Vite dev server whose page carries a reporter (scripts/lib/ios-tap-reporter.ts), opens it in
 * the booted iPhone simulator's Safari, taps and swipes with Facebook's idb — real touches through the
 * simulator's input, which WebDriver's synthesized ones are not (Safari drops them on the Simulator, and a
 * WebDriver session's overlay would swallow real ones) — and checks, from what the page reports after each
 * step, that the touch landed where aimed and that exactly the expected breakdown is open. Screenshots go to
 * .cache/ios-tap-check/. Exits 1 when a step fails.
 *
 * Needs Xcode with a booted iPhone simulator, `idb_companion` on PATH (`brew install facebook/fb/idb-companion`)
 * and the idb client, run by default as `uvx --from fb-idb==1.6.2 idb` (override with IDB="idb").
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { calibrate, isReport, judge, plausibleOffset, screenPoint, settled, usableRows, type Point, type Report } from "./lib/ios-tap.ts";

// Absolute: simctl resolves a relative screenshot path against its own working directory, not ours.
const OUT = resolve(".cache/ios-tap-check");
const IDB = (process.env.IDB ?? "uvx --from fb-idb==1.6.2 idb").split(" ");
const QUIET_MS = 700;

interface Plan {
  kind: "tap" | "swipe";
  target: string;
  /** Points below the target's top edge to touch (default: its centre). */
  dy?: number;
  expect: string[];
}
interface Step {
  name: string;
  plan: (r: Report) => Plan;
}

function args(argv: readonly string[]): { udid: string | null; port: number } {
  const at = (flag: string): string | undefined => argv[argv.indexOf(flag) + 1];
  return { udid: argv.includes("--udid") ? (at("--udid") ?? null) : null, port: argv.includes("--port") ? Number(at("--port")) : 5198 };
}

async function run(cmd: readonly string[]): Promise<string> {
  const proc = Bun.spawn([...cmd], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`${cmd.join(" ")} exited ${code}: ${err.trim() || out.trim()}`);
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

async function bootedIphone(): Promise<string> {
  const listed: unknown = JSON.parse(await run(["xcrun", "simctl", "list", "devices", "booted", "-j"]));
  const devices = isRecord(listed) && isRecord(listed.devices) ? Object.values(listed.devices).flat() : [];
  for (const d of devices) if (isRecord(d) && typeof d.name === "string" && d.name.startsWith("iPhone") && typeof d.udid === "string") return d.udid;
  throw new Error("no booted iPhone simulator: boot one (xcrun simctl boot 'iPhone 17 Pro'; open -a Simulator) or pass --udid");
}

/** The page's reports, as they arrive from the reporter. */
class Page {
  latest: Report | null = null;
  at = 0;
  constructor(readonly runId: string) {}
  /** Reports from another run's tab (Safari keeps old ones) are ignored. */
  receive = (r: Report): void => {
    if (r.run !== this.runId) return;
    this.latest = r;
    this.at = Date.now();
  };
  async settle(actionAt: number, timeoutMs = 15000): Promise<Report> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.latest && settled(this.at, actionAt, Date.now(), QUIET_MS)) return this.latest;
      await Bun.sleep(100);
    }
    throw new Error("the page did not report in time (is Safari showing the page?)");
  }
  /**
   * After a touch: wait for the report showing that touch ended (idb returns before the page has posted, so timing
   * alone can pick up a report from before the touch), then for the page to go quiet — the click that opens or
   * closes a sheet follows the lift. A touch that never arrives falls through after 5 s and `judge` names it.
   */
  async afterTouch(sinceSeq: number): Promise<Report> {
    const deadline = Date.now() + 5000;
    const done = (): boolean => {
      const down = this.latest?.lastDown;
      return down !== null && down !== undefined && down.seq > sinceSeq && down.ended;
    };
    while (Date.now() < deadline && !done()) await Bun.sleep(50);
    return this.settle(Date.now());
  }
}

function reporterPlugin(page: Page): Plugin {
  return {
    name: "ios-tap-check-reporter",
    transformIndexHtml: (html) => html.replace("</body>", `<script type="module" src="/scripts/lib/ios-tap-reporter.ts"></script></body>`),
    configureServer(server) {
      server.middlewares.use("/__tapcheck", (req, res) => {
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk.toString()));
        req.on("end", () => {
          const parsed: unknown = JSON.parse(body);
          if (isReport(parsed)) page.receive(parsed);
          res.end("ok");
        });
      });
    },
  };
}

async function startServer(port: number, page: Page): Promise<ViteDevServer> {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "warn", server: { host: "localhost", port, strictPort: true }, plugins: [reporterPlugin(page)] });
  await server.listen();
  return server;
}

const idb = (udid: string, sub: readonly string[]): Promise<string> => run([...IDB, "ui", ...sub, "--udid", udid]);
const shot = (udid: string, name: string): Promise<string> => run(["xcrun", "simctl", "io", udid, "screenshot", `${OUT}/${name}.png`]);
const n = (p: Point): string[] => [String(p.x), String(p.y)];

/** The table rows a tap can use in this report (below the sticky header, above where the sheet opens). */
const rowsOf = (r: Report): number[] => usableRows(r, r.targets.header ? r.targets.header.y + r.targets.header.h : 0);

/** One touch on a harmless spot (a card cell) tells where the web view sits on the screen. */
async function calibrateOffset(udid: string, page: Page, first: Report): Promise<Point> {
  const row = rowsOf(first)[1];
  const card = row === undefined ? undefined : first.targets[`card:${row}`];
  if (!card) throw new Error("no card row on screen to calibrate with");
  const aim = screenPoint(card, { x: 0, y: 0 });
  await idb(udid, ["tap", ...n(aim)]);
  const after = await page.afterTouch(first.lastDown?.seq ?? 0);
  if (!after.lastDown || after.open.length > 0) throw new Error(`calibration touch did not reach the page cleanly: ${JSON.stringify(after.lastDown)}, open [${after.open.join(", ")}]`);
  const offset = calibrate(aim, after.lastDown.at);
  if (!plausibleOffset(offset)) throw new Error(`implausible web-view offset ${JSON.stringify(offset)}: is Safari zoomed or rotated?`);
  return offset;
}

function steps(first: Report): Step[] {
  const rows = rowsOf(first);
  const [a, , c] = rows;
  if (a === undefined || c === undefined) throw new Error(`need three table rows on screen, found ${rows.length}`);
  const later = (r: Report, i: number): number => {
    const row = rowsOf(r)[i];
    if (row === undefined) throw new Error("the table scrolled out of reach");
    return row;
  };
  return [
    { name: "tap a 凸0 score: its sheet opens", plan: () => ({ kind: "tap", target: `score:${a}:0`, expect: [`${a}:0`] }) },
    { name: "tap another row's 凸3: the sheet switches", plan: () => ({ kind: "tap", target: `score:${c}:3`, expect: [`${c}:3`] }) },
    { name: "tap the same score again: it closes", plan: () => ({ kind: "tap", target: `score:${c}:3`, expect: [] }) },
    { name: "tap a 凸4 score: its sheet opens", plan: () => ({ kind: "tap", target: `score:${a}:4`, expect: [`${a}:4`] }) },
    { name: "tap inside the sheet: it stays", plan: () => ({ kind: "tap", target: "sheet", dy: 24, expect: [`${a}:4`] }) },
    { name: "swipe inside the sheet: it stays", plan: () => ({ kind: "swipe", target: "sheet", dy: 24, expect: [`${a}:4`] }) },
    { name: "swipe starting on a thumbnail (a scroll, not a tap): it stays", plan: (r) => ({ kind: "swipe", target: `thumb:${later(r, 1)}`, expect: [`${a}:4`] }) },
    { name: "tap a thumbnail (outside): it closes", plan: (r) => ({ kind: "tap", target: `thumb:${later(r, 1)}`, expect: [] }) },
    { name: "tap a 凸2 score: its sheet opens", plan: (r) => ({ kind: "tap", target: `score:${later(r, 0)}:2`, expect: [`${later(r, 0)}:2`] }) },
    { name: "tap a rarity badge (outside, not clickable): it closes", plan: (r) => ({ kind: "tap", target: `badge:${later(r, 2)}`, expect: [] }) },
  ];
}

async function perform(udid: string, plan: Plan, at: Point): Promise<void> {
  if (plan.kind === "tap") await idb(udid, ["tap", ...n(at)]);
  else await idb(udid, ["swipe", ...n(at), ...n({ x: at.x, y: at.y - 60 }), "--duration", "0.4"]);
}

async function runSteps(udid: string, page: Page, offset: Point, list: readonly Step[]): Promise<boolean> {
  let passed = true;
  for (const [i, step] of list.entries()) {
    const before = await page.settle(0);
    const plan = step.plan(before);
    const rect = before.targets[plan.target];
    if (rect) await perform(udid, plan, screenPoint(rect, offset, plan.dy));
    const after = rect ? await page.afterTouch(before.lastDown?.seq ?? 0) : before;
    await shot(udid, `${String(i + 1).padStart(2, "0")}`);
    const verdict = rect ? judge(after, plan.target, plan.expect, before.lastDown?.seq ?? 0) : { ok: false, problems: [`${plan.target} is not on screen`] };
    console.log(`${verdict.ok ? "✓" : "✗"} ${i + 1}. ${step.name}${verdict.ok ? "" : ` — ${verdict.problems.join("; ")}`}`);
    passed &&= verdict.ok;
  }
  return passed;
}

async function check(opts: { udid: string | null; port: number }): Promise<number> {
  const udid = opts.udid ?? (await bootedIphone());
  mkdirSync(OUT, { recursive: true });
  const runId = String(Date.now());
  const page = new Page(runId);
  const server = await startServer(opts.port, page);
  try {
    console.log(`opening the page in simulator ${udid}…`);
    await run(["xcrun", "simctl", "openurl", udid, `http://localhost:${opts.port}/?tapcheck=${runId}`]);
    const first = await page.settle(Date.now(), 60000);
    console.log("page reported; calibrating with one touch…");
    const offset = await calibrateOffset(udid, page, first);
    console.log(`web view at +${offset.x},+${offset.y} pt; screenshots in ${OUT}/`);
    const ok = await runSteps(udid, page, offset, steps(await page.settle(0)));
    console.log(ok ? "all steps passed" : "some steps failed");
    return ok ? 0 : 1;
  } finally {
    // Safari keeps the dev server's HMR socket open, so closing can wait on it indefinitely.
    await Promise.race([server.close(), Bun.sleep(2000)]);
  }
}

/** 0 all steps passed, 1 a step failed, 2 the check could not run (no simulator, port taken, page silent, …). */
async function main(): Promise<number> {
  try {
    return await check(args(process.argv.slice(2)));
  } catch (e) {
    console.error(`stopped: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
}

process.exit(await main());
