import { describe, expect, test } from "bun:test";
import { moveThumb, roleLabels, step } from "./share.ts";

describe("moveThumb", () => {
  test("the first thumb moves the main/sub boundary and cannot pass the second", () => {
    expect(moveThumb([2, 7, 1], 0, 4)).toEqual([4, 5, 1]);
    expect(moveThumb([2, 7, 1], 0, 0)).toEqual([0, 9, 1]);
    expect(moveThumb([2, 7, 1], 0, 10)).toEqual([9, 0, 1]);
  });

  test("the second thumb moves the sub/other boundary and cannot pass the first", () => {
    expect(moveThumb([2, 7, 1], 1, 5)).toEqual([2, 3, 5]);
    expect(moveThumb([2, 7, 1], 1, 10)).toEqual([2, 8, 0]);
    expect(moveThumb([2, 7, 1], 1, 0)).toEqual([2, 0, 8]);
  });

  test("positions are rounded and clamped to 0–10; a non-finite position changes nothing", () => {
    expect(moveThumb([2, 7, 1], 0, 3.4)).toEqual([3, 6, 1]);
    expect(moveThumb([2, 7, 1], 1, 42)).toEqual([2, 8, 0]);
    expect(moveThumb([2, 7, 1], 0, -3)).toEqual([0, 9, 1]);
    expect(moveThumb([2, 7, 1], 0, Number.NaN)).toEqual([2, 7, 1]);
    expect(moveThumb([2, 7, 1], 1, Number.POSITIVE_INFINITY)).toEqual([2, 7, 1]);
  });
});

describe("step", () => {
  test("+1 on a role takes one tenth from the next role that has any", () => {
    expect(step([2, 7, 1], 0, 1)).toEqual([3, 6, 1]);
    expect(step([2, 0, 8], 0, 1)).toEqual([3, 0, 7]); // sub is empty, so from other
    expect(step([2, 7, 1], 2, 1)).toEqual([2, 6, 2]);
  });

  test("−1 on a role gives the tenth to the next role; nothing happens at 0", () => {
    expect(step([2, 7, 1], 1, -1)).toEqual([2, 6, 2]);
    expect(step([2, 7, 1], 2, -1)).toEqual([2, 8, 0]);
    expect(step([2, 8, 0], 2, -1)).toEqual([2, 8, 0]);
  });

  test("+1 when every other role is empty changes nothing; the input is not mutated", () => {
    const full: readonly [number, number, number] = [10, 0, 0];
    expect(step(full, 0, 1)).toEqual([10, 0, 0]);
    const s: readonly [number, number, number] = [2, 7, 1];
    step(s, 0, 1);
    expect(s).toEqual([2, 7, 1]);
  });
});

describe("roleLabels", () => {
  test("role names under 「カードごとに最適」, stat names under a fixed preset", () => {
    expect(roleLabels(null).map((l) => l.text)).toEqual(["メイン", "サブ", "その他"]);
    expect(roleLabels({ vocal: 1, dance: 7, visual: 0 }).map((l) => l.text)).toEqual(["Da", "Vo", "Vi"]);
    expect(roleLabels({ vocal: 0, dance: 1, visual: 7 }).map((l) => l.text)).toEqual(["Vi", "Da", "Vo"]);
  });

  test("a preset that names its sub puts that stat second, as the badges beside レッスン配分 show it", () => {
    expect(roleLabels({ vocal: 8, dance: 0, visual: 0, sub: "dance" }).map((l) => l.text)).toEqual(["Vo", "Da", "Vi"]);
    expect(roleLabels({ vocal: 8, dance: 0, visual: 0, sub: "visual" }).map((l) => l.text)).toEqual(["Vo", "Vi", "Da"]);
  });
});
