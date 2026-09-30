/**
 * A count field in a simulated DOM (happy-dom) under a parent that behaves like the
 * panels: an emptied count goes back to its default, and the field is re-rendered
 * with whatever the parent stores. Typing is simulated by setting the value and
 * dispatching `input`, as a phone keyboard does; there are no spinner buttons.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { render } from "preact";
import { useState } from "preact/hooks";
import { act } from "preact/test-utils";
import { CountField } from "./CountField.tsx";
import { CustomizePanel } from "./CustomizePanel.tsx";
import { itemCapKey, type ItemRow } from "./item-panel.ts";
import { ItemPanel } from "./ItemPanel.tsx";

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

/** Stores a typed count; an empty or out-of-range one goes back to `base`, as the panels do. Two buttons change it from elsewhere: 既定に戻す, and a cap lowered to 4 (a parent count cut). */
function Parent({ base, max: initialMax, seen }: { base: number; max: number | null; seen: string[] }) {
  const [value, setValue] = useState(base);
  const [max, setMax] = useState(initialMax);
  const onCount = (raw: string): void => {
    seen.push(raw);
    const n = Number(raw);
    setValue(raw === "" || !Number.isInteger(n) || n < 0 ? base : max === null ? n : Math.min(n, max));
  };
  return (
    <>
      <CountField value={value} max={max} overridden={value !== base} onCount={onCount} />
      <output>{value}</output>
      <button type="button" id="reset" onClick={() => setValue(base)} />
      <button
        type="button"
        id="cut"
        onClick={() => {
          setMax(4);
          setValue(Math.min(value, 4));
        }}
      />
    </>
  );
}

const field = (): HTMLInputElement => must(root.querySelector("input"), "the count field");
const stored = (): string => must(root.querySelector("output"), "the stored count").textContent ?? "";

async function type(text: string): Promise<void> {
  await act(() => {
    field().value = text;
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

test("a one-digit count can be emptied and retyped to another digit", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={3} max={null} seen={seen} />, root));
  await type("");
  expect(field().value).toBe("");
  expect(seen).toEqual([]);
  await type("5");
  expect(field().value).toBe("5");
  expect(stored()).toBe("5");
});

test("a capped count can be lowered by retyping it", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={3} max={3} seen={seen} />, root));
  await type("");
  await type(`${field().value}1`); // a keyboard appends to what the field shows
  expect(stored()).toBe("1");
});

test("a count typed over the cap shows the cap", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={2} max={3} seen={seen} />, root));
  await type("35");
  expect(field().value).toBe("3");
  expect(stored()).toBe("3");
});

test("leaving an emptied field shows the stored count again", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={3} max={null} seen={seen} />, root));
  await type("");
  await act(() => {
    field().dispatchEvent(new Event("blur"));
  });
  expect(field().value).toBe("3");
});

async function press(id: string): Promise<void> {
  await act(() => {
    must(root.querySelector<HTMLButtonElement>(`#${id}`), id).click();
  });
}

test("a typed count gives way when the stored count is changed from elsewhere while the field has focus", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={3} max={null} seen={seen} />, root));
  await type("7");
  expect(field().value).toBe("7");
  await press("reset");
  expect(field().value).toBe("3");
});

test("a typed count gives way when a lower cap cuts it", async () => {
  const seen: string[] = [];
  await act(() => render(<Parent base={3} max={8} seen={seen} />, root));
  await type("7");
  await press("cut");
  expect(stored()).toBe("4");
  expect(field().value).toBe("4");
});

test("both panels hand an emptied count on to nothing and a retyped one on as the new count", async () => {
  const changes: Record<string, number>[] = [];
  const onChange = (next: Record<string, number>): void => void changes.push(next);
  const input = { key: "o.StartShop", label: "ショップ", base: 3, unset: 3, value: 3, max: 3, overridden: false, readOnly: false, used: true, children: [] };
  const row: ItemRow = { itemId: "item-x", itemName: "X", assetId: "x", cardName: "C", cardAssetId: "c", cardType: "vocal", trigger: undefined, cap: undefined, computed: 3, value: 3, overridden: false };
  await act(() =>
    render(
      <>
        <CustomizePanel profileName="P" sections={[{ id: "actions", title: "行動", inputs: [input] }]} overrides={{}} onChange={onChange} />
        <ItemPanel items={[row]} overrides={{}} onChange={onChange} />
      </>,
      root,
    ),
  );
  const fields: [number, string][] = [
    [0, "o.StartShop"],
    [1, itemCapKey("item-x")],
  ];
  for (const [i, key] of fields) {
    const el = must(root.querySelectorAll("input")[i], `count field ${i}`);
    changes.length = 0;
    await act(() => {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(el.value).toBe("");
    expect(changes).toEqual([]);
    await act(() => {
      el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(changes).toEqual([{ [key]: 1 }]);
  }
});
