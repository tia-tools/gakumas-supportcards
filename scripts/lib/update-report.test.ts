import { describe, expect, test } from "bun:test";
import type { Snapshot } from "./score-snapshot.ts";
import { diffSnapshots, isEmpty, renderHeldIssue, renderPullRequest, updateTitle } from "./update-report.ts";

const entry = (name: string, data: string, score = 100) => ({ name, data, scores: { "hif/sashiire": [score, 1, 2, 3, score + 50] } });
const base: Snapshot = { "s-1": entry("旧カード", "h1"), "s-2": entry("調整されるカード", "h2"), "s-3": entry("消えるカード", "h3") };
const current: Snapshot = { "s-1": entry("旧カード", "h1"), "s-2": entry("調整されるカード", "h2-new"), "s-4": entry("新カード", "h4", 300) };

describe("diffSnapshots", () => {
  test("separates new, removed and data-changed cards; an unchanged card is in none", () => {
    const d = diffSnapshots(base, current);
    expect(d.added).toEqual([{ id: "s-4", name: "新カード" }]);
    expect(d.removed).toEqual([{ id: "s-3", name: "消えるカード" }]);
    expect(d.changed).toEqual([{ id: "s-2", name: "調整されるカード" }]);
    expect(isEmpty(d)).toBe(false);
  });

  test("identical snapshots are an empty diff", () => {
    expect(isEmpty(diffSnapshots(base, base))).toBe(true);
  });
});

describe("updateTitle", () => {
  test("follows the commit house style and mentions removed and held only when there are any", () => {
    expect(updateTitle(diffSnapshots(base, base), [], "2026-09-22")).toBe("chore: data update 2026-09-22 — 0 new, 0 changed");
    expect(updateTitle(diffSnapshots(base, current), [{ id: "s-9", name: "x", reasons: ["r"] }], "2026-09-22")).toBe("chore: data update 2026-09-22 — 1 new, 1 changed, 1 removed, 1 held");
  });
});

describe("renderPullRequest", () => {
  test("lists each group with scores for new cards and leaves out empty groups", () => {
    const body = renderPullRequest(diffSnapshots(base, current), [], current, "https://example.test/run/1");
    expect(body).toContain("### New cards (1)");
    expect(body).toContain("- `s-4` 新カード — hif/sashiire 凸0 300 / 凸4 350");
    expect(body).toContain("### Cards whose data changed (1)");
    expect(body).toContain("### Cards removed upstream (1)");
    expect(body).not.toContain("Held cards");
    expect(body).toContain("Run: https://example.test/run/1");
  });

  test("names held cards and points at the issue", () => {
    const body = renderPullRequest(diffSnapshots(base, base), [{ id: "s-9", name: "謎のカード", reasons: ["unknown piece `foo`"] }], base);
    expect(body).toContain("### Held cards (1)");
    expect(body).toContain("- `s-9` 謎のカード");
    expect(body).not.toContain("### New cards");
  });
});

describe("renderHeldIssue", () => {
  test("gives every held card its reasons", () => {
    const body = renderHeldIssue([{ id: "s-9", name: "謎のカード", reasons: ["unknown piece `foo`", "no profile counts phase `Bar`"] }]);
    expect(body).toContain("### `s-9` 謎のカード");
    expect(body).toContain("- unknown piece `foo`");
    expect(body).toContain("- no profile counts phase `Bar`");
  });
});
