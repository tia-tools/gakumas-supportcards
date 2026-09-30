import { expect, test } from "bun:test";
import { editCount } from "./count-field.ts";

test("an emptied field stays empty and hands nothing on, so a one-digit count can be retyped", () => {
  expect(editCount("", 3)).toEqual({ text: "", commit: null });
  expect(editCount("", null)).toEqual({ text: "", commit: null });
});

test("a count within the cap, or with no cap, is shown and handed on as typed", () => {
  expect(editCount("2", 3)).toEqual({ text: "2", commit: "2" });
  expect(editCount("3", 3)).toEqual({ text: "3", commit: "3" });
  expect(editCount("45", null)).toEqual({ text: "45", commit: "45" });
});

test("a count over the cap shows and hands on the cap", () => {
  expect(editCount("7", 3)).toEqual({ text: "3", commit: "3" });
  expect(editCount("35", 3)).toEqual({ text: "3", commit: "3" });
});
