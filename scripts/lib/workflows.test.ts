/**
 * The workflows cannot be run locally, so the properties that make them safe are pinned here:
 * what triggers them, what they may write, that only `main` is ever deployed, that every gate
 * sits before the merge, and that no step splices an expression into a shell script.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  "continue-on-error"?: boolean;
}
interface Job {
  steps?: Step[];
  uses?: string;
  needs?: string;
  if?: string;
  secrets?: string;
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
}

function read(name: string): { text: string; wf: Workflow } {
  const text = readFileSync(`.github/workflows/${name}`, "utf8");
  return { text, wf: load(text) as Workflow };
}
const stepsOf = (wf: Workflow, job: string): Step[] => wf.jobs[job]?.steps ?? [];
const indexOfRun = (steps: Step[], needle: string): number => steps.findIndex((s) => (s.run ?? "").includes(needle));

const ALLOWED_ACTIONS = [
  "actions/checkout@v4",
  "oven-sh/setup-bun@v2",
  "astral-sh/setup-uv@v7",
  "Taka499/nudge/actions/notify@b706447babea35d3b95dcdbae7ec03f007cb2b2a",
];

for (const name of ["deploy.yml", "update-data.yml"]) {
  describe(name, () => {
    const { text, wf } = read(name);

    test("opens by stating what it guards", () => {
      expect(text.startsWith("# Guards: ")).toBe(true);
    });

    test("uses only the allowed actions and never pull_request_target", () => {
      const used = Object.values(wf.jobs).flatMap((j) => (j.steps ?? []).map((s) => s.uses).filter((u): u is string => u !== undefined));
      for (const u of used) expect(ALLOWED_ACTIONS).toContain(u);
      expect(Object.keys(wf.on)).not.toContain("pull_request_target");
    });

    test("no shell script has an expression spliced into it; values arrive through env", () => {
      for (const job of Object.values(wf.jobs)) for (const s of job.steps ?? []) expect(s.run ?? "").not.toContain("${{");
    });

    test("checks out main explicitly", () => {
      for (const job of Object.values(wf.jobs)) {
        const checkout = (job.steps ?? []).find((s) => s.uses?.startsWith("actions/checkout@"));
        if (job.steps) expect(checkout?.with?.ref).toBe("main");
      }
    });
  });
}

describe("deploy.yml", () => {
  const { wf } = read("deploy.yml");

  test("runs for pushes to main only, on call and by hand, and can write nothing", () => {
    expect(Object.keys(wf.on).sort()).toEqual(["push", "workflow_call", "workflow_dispatch"]);
    expect((wf.on.push as { branches: string[] }).branches).toEqual(["main"]);
    expect(wf.permissions).toEqual({ contents: "read" });
  });

  test("tests, type check and snapshot check all come before the deploy", () => {
    const steps = stepsOf(wf, "deploy");
    const deploy = indexOfRun(steps, "wrangler@4 deploy");
    expect(deploy).toBeGreaterThan(0);
    for (const gate of ["bun test", "bun run type-check", "check-score-stability.ts", "bun run build"]) {
      const i = indexOfRun(steps, gate);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(deploy);
    }
  });
});

describe("update-data.yml", () => {
  const { wf } = read("update-data.yml");
  const steps = stepsOf(wf, "update");

  test("runs on a schedule and by hand, with exactly the permissions it needs", () => {
    expect(Object.keys(wf.on).sort()).toEqual(["schedule", "workflow_dispatch"]);
    expect(wf.permissions).toEqual({ contents: "write", "pull-requests": "write", issues: "write", "id-token": "write" });
  });

  test("every gate comes before the merge, and none of them may be skipped on failure", () => {
    const merge = indexOfRun(steps, "gh pr merge");
    expect(merge).toBeGreaterThan(0);
    for (const gate of ["bun run generate", "bun test", "bun run type-check", "check-score-stability.ts --base HEAD"]) {
      const i = indexOfRun(steps, gate);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(merge);
      expect(steps[i]?.["continue-on-error"]).toBeUndefined();
    }
  });

  test("only the image steps are best-effort", () => {
    const soft = steps.filter((s) => s["continue-on-error"] === true).map((s) => s.uses ?? s.name);
    expect(soft).toEqual(["astral-sh/setup-uv@v7", "Images for cards the site does not show yet"]);
  });

  test("merges with a merge commit, never a squash or a rebase, and never pushes to main directly", () => {
    const scripts = steps.map((s) => s.run ?? "").join("\n");
    expect(scripts).toContain("gh pr merge");
    expect(scripts).toContain("--merge");
    expect(scripts).not.toMatch(/--squash|--rebase|push origin main/);
    expect(scripts).not.toMatch(/git push[^\n]*(--force|-f\b)/); // `gh label create --force` is an upsert, not a push
  });

  test("deploys through deploy.yml, only after a change", () => {
    expect(wf.jobs.deploy?.uses).toBe("./.github/workflows/deploy.yml");
    expect(wf.jobs.deploy?.needs).toBe("update");
    expect(wf.jobs.deploy?.if).toBe("needs.update.outputs.changed == 'true'");
    expect(wf.jobs.deploy?.secrets).toBe("inherit");
  });
});
