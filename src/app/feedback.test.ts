import { describe, expect, test } from "bun:test";
import { FEEDBACK_MESSAGE_MAX } from "../../infra/worker/feedback-contract.ts";
import { parsePayload } from "../../infra/worker/feedback.ts";
import { buildPayload, resultText, viewToAttach } from "./feedback.ts";

describe("viewToAttach", () => {
  test("re-encodes the query string so the Worker accepts it", () => {
    expect(viewToAttach("")).toBe("");
    expect(viewToAttach("?")).toBe("");
    expect(viewToAttach("?p=sashiire&o.LessonEnd=6")).toBe("?p=sashiire&o.LessonEnd=6");
    // Characters a browser may leave unencoded in location.search.
    expect(viewToAttach("?x=a'b(c)!:/@")).toBe("?x=a%27b%28c%29%21%3A%2F%40");
  });

  test("drops a query too long to attach instead of sending one the Worker refuses", () => {
    expect(viewToAttach(`?x=${"a".repeat(3000)}`)).toBe("");
  });
});

describe("buildPayload", () => {
  test("what the form builds is what the Worker accepts", () => {
    const payload = buildPayload("bug", "  数字が違う  ", "?t=vocal&x=(1)", "abc1234def56");
    expect(payload).toEqual({ category: "bug", message: "数字が違う", view: "?t=vocal&x=%281%29", commit: "abc1234def56" });
    expect(parsePayload(JSON.stringify(payload))).toEqual(payload);
  });

  test("an empty or over-long message cannot be sent", () => {
    expect(buildPayload("bug", "   ", "", "unknown")).toBeNull();
    expect(buildPayload("bug", "x".repeat(FEEDBACK_MESSAGE_MAX + 1), "", "unknown")).toBeNull();
  });
});

describe("resultText", () => {
  test("distinguishes success, the daily limit and failures", () => {
    expect(resultText(200)).toContain("送信しました");
    expect(resultText(429)).toContain("上限");
    expect(resultText(0)).toContain("通信");
    expect(resultText(502)).not.toBe(resultText(200));
  });
});
