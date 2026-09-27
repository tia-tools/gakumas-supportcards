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
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  "continue-on-error"?: boolean;
}
interface Job {
  steps?: Step[];
  uses?: string;
  needs?: string | string[];
  if?: string;
  secrets?: string;
  permissions?: Record<string, string>;
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

/**
 * The actions a workflow may use, by name. Each must be pinned to a full commit hash, which
 * Dependabot keeps current together with its version comment (first plan, decision D47): a tag can
 * be moved to other code, a commit cannot.
 */
const ALLOWED_ACTIONS = ["actions/checkout", "oven-sh/setup-bun", "astral-sh/setup-uv", "Taka499/nudge/actions/notify"];
/** The whole `uses:` value: one name, one `@`, a full commit hash, nothing after it. */
const PINNED = /^([^@\s]+)@[0-9a-f]{40}$/;
const actionName = (uses: string): string => uses.split("@")[0] ?? uses;
const branchesOf = (trigger: unknown): unknown =>
  typeof trigger === "object" && trigger !== null && "branches" in trigger ? trigger.branches : undefined;

for (const name of ["deploy.yml", "update-data.yml", "check.yml"]) {
  describe(name, () => {
    const { text, wf } = read(name);

    test("opens by stating what it guards", () => {
      expect(text.startsWith("# Guards: ")).toBe(true);
    });

    test("uses only the allowed actions, each pinned to a full commit hash, and never pull_request_target", () => {
      const used = Object.values(wf.jobs).flatMap((j) => (j.steps ?? []).map((s) => s.uses).filter((u): u is string => u !== undefined));
      for (const u of used) {
        expect(u).toMatch(PINNED);
        expect(ALLOWED_ACTIONS).toContain(PINNED.exec(u)?.[1] ?? "");
      }
      expect(Object.keys(wf.on)).not.toContain("pull_request_target");
    });

    test("no shell script has an expression spliced into it; values arrive through env", () => {
      for (const job of Object.values(wf.jobs)) for (const s of job.steps ?? []) expect(s.run ?? "").not.toContain("${{");
    });
  });
}

// The two workflows that publish build from main and nothing else; check.yml tests the pull request's own code.
for (const name of ["deploy.yml", "update-data.yml"]) {
  test(`${name} checks out main explicitly, wherever it checks out`, () => {
    const checkouts = Object.values(read(name).wf.jobs).flatMap((job) => (job.steps ?? []).filter((s) => s.uses?.startsWith("actions/checkout@")));
    expect(checkouts.length).toBeGreaterThan(0);
    for (const c of checkouts) expect(c.with?.ref).toBe("main");
  });
}

describe("check.yml", () => {
  const { wf } = read("check.yml");
  const steps = stepsOf(wf, "check");

  test("runs on pull requests into develop only, and can write nothing", () => {
    expect(Object.keys(wf.on)).toEqual(["pull_request"]);
    expect(branchesOf(wf.on.pull_request)).toEqual(["develop"]);
    expect(wf.permissions).toEqual({ contents: "read" });
  });

  test("runs every check deploy.yml runs before production", () => {
    for (const gate of ["bun test", "bun run type-check", "check-score-stability.ts", "bun run build"]) {
      expect(indexOfRun(steps, gate)).toBeGreaterThanOrEqual(0);
    }
  });
});

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
    // Nothing at workflow level; only notify can mint an OIDC token, and deploy only reads.
    expect(wf.permissions).toEqual({});
    expect(wf.jobs.update?.permissions).toEqual({ contents: "write", "pull-requests": "write", issues: "write" });
    expect(wf.jobs.deploy?.permissions).toEqual({ contents: "read" });
    expect(wf.jobs.notify?.permissions).toEqual({ "id-token": "write" });
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
    const soft = steps.filter((s) => s["continue-on-error"] === true).map((s) => (s.uses ? actionName(s.uses) : s.name));
    expect(soft).toEqual(["astral-sh/setup-uv", "Images for cards the site does not show yet"]);
  });

  test("merges with a merge commit, never a squash or a rebase, and never pushes to main directly", () => {
    const scripts = steps.map((s) => s.run ?? "").join("\n");
    expect(scripts).toContain("gh pr merge");
    expect(scripts).toContain("--merge");
    expect(scripts).not.toMatch(/--squash|--rebase|push origin main/);
    expect(scripts).not.toMatch(/git push[^\n]*(--force|-f\b)/); // `gh label create --force` is an upsert, not a push
  });

  test("runs daily at 11:30 JST (D46)", () => {
    expect(wf.on.schedule).toEqual([{ cron: "30 2 * * *" }]);
  });

  test("tells Discord in a last job, after any update or deploy that did not succeed, a change, a manual run, and on Mondays (D43, D46)", () => {
    const notify = wf.jobs.notify;
    expect(notify?.needs).toEqual(["update", "deploy"]);
    expect(notify?.if).toBe("always()");
    const own = stepsOf(wf, "notify");
    expect(own[0]?.id).toBe("when");
    const last = own[own.length - 1];
    expect(actionName(last?.uses ?? "")).toBe("Taka499/nudge/actions/notify");
    const condition = last?.if ?? "";
    for (const part of [
      "needs.update.result != 'success'",
      "needs.deploy.result != 'success' && needs.deploy.result != 'skipped'",
      "needs.update.outputs.changed == 'true'",
      "github.event_name == 'workflow_dispatch'",
      "steps.when.outputs.weekday == '1'",
    ]) {
      expect(condition).toContain(part);
    }
    expect(steps.some((s) => actionName(s.uses ?? "") === "Taka499/nudge/actions/notify")).toBe(false);
  });

  test("deploys through deploy.yml, only after a change", () => {
    expect(wf.jobs.deploy?.uses).toBe("./.github/workflows/deploy.yml");
    expect(wf.jobs.deploy?.needs).toBe("update");
    expect(wf.jobs.deploy?.if).toBe("needs.update.outputs.changed == 'true'");
    expect(wf.jobs.deploy?.secrets).toBe("inherit");
  });
});
