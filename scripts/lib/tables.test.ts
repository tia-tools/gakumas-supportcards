import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTypedTable } from "./tables.ts";

interface Row {
  id: string;
  upgradeCount: number;
  isCharacterAsset: boolean;
  produceCardCustomizeIds: string[];
}
const FIELDS = { id: "string", upgradeCount: "number", isCharacterAsset: "boolean", produceCardCustomizeIds: "string[]" } as const;

const dir = mkdtempSync(join(tmpdir(), "tables-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The message `promise` rejects with, or "resolved". */
async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "resolved";
}

/** Loads `yaml` as the table `name` from a cache directory of its own; no network. */
async function load(name: string, yaml: string): Promise<Row[]> {
  writeFileSync(join(dir, `${name}.yaml`), yaml);
  return loadTypedTable<Row>(name, FIELDS, { cacheDir: dir, baseUrl: "http://127.0.0.1:9/" });
}

const GOOD = `- id: p_card-01-act-1_001
  upgradeCount: 1
  isCharacterAsset: false
  produceCardCustomizeIds: [k-1, k-2]
  extra: ignored
`;

describe("loadTypedTable", () => {
  test("loads rows whose declared fields have their types", async () => {
    const rows: unknown = await load("Good", GOOD);
    expect(rows).toEqual([{ id: "p_card-01-act-1_001", upgradeCount: 1, isCharacterAsset: false, produceCardCustomizeIds: ["k-1", "k-2"], extra: "ignored" }]);
  });

  test("stops on a value of another type, naming the table, the row and the field", async () => {
    expect(await failure(load("QuotedNumber", GOOD.replace("upgradeCount: 1", 'upgradeCount: "1"')))).toContain('QuotedNumber.yaml: row 0 (p_card-01-act-1_001): upgradeCount should be number, is "1"');
    expect(await failure(load("StringBool", GOOD.replace("isCharacterAsset: false", 'isCharacterAsset: "false"')))).toContain("isCharacterAsset should be boolean");
  });

  test("stops on a list holding something other than strings, or a missing field", async () => {
    expect(await failure(load("NumberInList", GOOD.replace("[k-1, k-2]", "[k-1, 2]")))).toContain("produceCardCustomizeIds should be string[]");
    expect(await failure(load("Missing", GOOD.replace("  upgradeCount: 1\n", "")))).toContain("upgradeCount should be number, is missing");
  });

  test("stops on a table that is not a list of mappings", async () => {
    expect(await failure(load("NotAList", "id: x\n"))).toContain("NotAList.yaml: expected a list of rows");
    expect(await failure(load("NotMappings", "- just a string\n"))).toContain("NotMappings.yaml: row 0 is not a mapping");
  });
});
