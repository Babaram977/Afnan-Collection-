import { describe, expect, it } from "vitest";
import { canonicalLines, groupOrderLines, parseSelections } from "../lib/order-lines";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

describe("order line selections", () => {
  it("keeps distinct selections of the same item as separate quantities", () => {
    expect(
      groupOrderLines([
        { variantId: A, qty: 1, note: "Colour: Red" },
        { variantId: A, qty: 2, note: "Colour: Blue" },
      ]),
    ).toEqual([
      {
        variantId: A,
        qty: 3,
        selections: [
          { qty: 1, note: "Colour: Red" },
          { qty: 2, note: "Colour: Blue" },
        ],
      },
    ]);
  });

  it("combines identical selections (including surrounding whitespace)", () => {
    expect(
      groupOrderLines([
        { variantId: A, qty: 1, note: "Colour: Red" },
        { variantId: A, qty: 1, note: "  Colour: Red " },
      ]),
    ).toEqual([{ variantId: A, qty: 2, selections: [{ qty: 2, note: "Colour: Red" }] }]);
  });

  it("treats a missing and an empty selection as the same 'no selection'", () => {
    expect(
      groupOrderLines([
        { variantId: A, qty: 1 },
        { variantId: A, qty: 2, note: "" },
      ]),
    ).toEqual([{ variantId: A, qty: 3, selections: [{ qty: 3, note: null }] }]);
  });

  it("keeps different items apart", () => {
    const grouped = groupOrderLines([
      { variantId: A, qty: 1, note: "Size: 4" },
      { variantId: B, qty: 1, note: "Size: 4" },
    ]);
    expect(grouped.map((l) => [l.variantId, l.qty])).toEqual([
      [A, 1],
      [B, 1],
    ]);
  });

  it("gives the same canonical form regardless of line order", () => {
    const one = canonicalLines([
      { variantId: B, qty: 1 },
      { variantId: A, qty: 1, note: "Colour: Red" },
      { variantId: A, qty: 2, note: "Colour: Blue" },
    ]);
    const two = canonicalLines([
      { variantId: A, qty: 2, note: "Colour: Blue" },
      { variantId: B, qty: 1 },
      { variantId: A, qty: 1, note: "Colour: Red" },
    ]);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    expect(
      JSON.stringify(canonicalLines([{ variantId: A, qty: 2, note: "Colour: Red" }])),
    ).not.toBe(JSON.stringify(canonicalLines([{ variantId: A, qty: 2, note: "Colour: Blue" }])));
  });

  it("parses stored selections and tolerates legacy or malformed values", () => {
    expect(parseSelections('[{"qty":1,"note":"Colour: Red"},{"qty":2,"note":null}]')).toEqual([
      { qty: 1, note: "Colour: Red" },
      { qty: 2, note: null },
    ]);
    expect(parseSelections(null)).toEqual([]);
    expect(parseSelections("not json")).toEqual([]);
    expect(parseSelections('{"qty":1}')).toEqual([]);
    expect(parseSelections('[{"qty":"x","note":1}]')).toEqual([]);
  });
});
