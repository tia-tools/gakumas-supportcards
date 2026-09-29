/**
 * 「閉じる」 in a simulated DOM (happy-dom): it folds the panel it sits in and brings that
 * panel back into view. No layout: whether the summary lands clear of the sticky controls
 * is checked in a browser.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { render } from "preact";
import { act } from "preact/test-utils";
import { FoldButton } from "./FoldButton.tsx";

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} is missing`);
  return value;
}

let root: HTMLElement;

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

beforeEach(() => {
  root = document.body.appendChild(document.createElement("div"));
});
afterEach(() => act(() => render(null, root)));

test("閉じる folds the panel it sits in, scrolls that panel into view, and leaves another panel open", async () => {
  await act(() =>
    render(
      <>
        <details id="outer" open>
          <summary>outer</summary>
          <details id="other" open>
            <summary>other</summary>
          </details>
          <FoldButton />
        </details>
      </>,
      root,
    ),
  );
  const outer = must(root.querySelector<HTMLDetailsElement>("#outer"), "the panel");
  const other = must(root.querySelector<HTMLDetailsElement>("#other"), "the nested details");
  const scrolled: string[] = []; // ids: a failed match on elements would have bun print a happy-dom node, which does not finish
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  const button = must(outer.querySelector<HTMLButtonElement>(":scope > div > button"), "閉じる");
  await act(() => button.click());
  expect(outer.open).toBe(false);
  expect(other.open).toBe(true);
  expect(scrolled).toEqual(["outer"]);
});
