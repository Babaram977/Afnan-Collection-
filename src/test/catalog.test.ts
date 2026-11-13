import { describe, expect, it } from "vitest";
import { filterProducts, formatNaira, type Product } from "@/lib/catalog";
import { cartReducerAdd } from "@/lib/cart";

const p = (id: string, price: number, extra: Partial<Product> = {}): Product => ({ id, slug: id, name: id, category: "toys", ageGroups: ["baby"], images: [], variants: [{ id: id + "v", sku: id, size: "M", priceKobo: price, stock: null }], ...extra });

describe("catalog", () => {
  it("formats kobo as naira", () => { expect(formatNaira(250000)).toContain("2,500"); expect(formatNaira(250000)).toContain("₦"); });
  it("filters by naira price range", () => {
    const list = [p("a", 100000), p("b", 500000)];
    expect(filterProducts(list, { maxNaira: 2000 }).map((x) => x.id)).toEqual(["a"]);
    expect(filterProducts(list, { minNaira: 2000 }).map((x) => x.id)).toEqual(["b"]);
  });
  it("filters by age and category", () => {
    const list = [p("a", 1, { ageGroups: ["newborn"] }), p("b", 1, { category: "books" })];
    expect(filterProducts(list, { age: "newborn" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterProducts(list, { category: "books" }).map((x) => x.id)).toEqual(["b"]);
  });
  it("merges same variant in cart", () => {
    const l = { productId: "a", variantId: "v", name: "a", variantLabel: "", priceKobo: 1, qty: 1 };
    expect(cartReducerAdd(cartReducerAdd([], l), l)[0]?.qty).toBe(2);
  });
});
