import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { apiCall } from "./store";
import type { Product } from "./catalog";
export interface CartLine {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  priceKobo: number;
  qty: number;
  imageUrl?: string | undefined;
}
interface CartCtx {
  lines: CartLine[];
  count: number;
  subtotalKobo: number;
  add: (l: CartLine) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}
const Ctx = createContext<CartCtx | null>(null);
const KEY = "afnan-cart-v1";
const persisted = z
  .array(z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
  .max(50);
export function cartReducerAdd(lines: CartLine[], l: CartLine): CartLine[] {
  if (
    !Number.isInteger(l.qty) ||
    l.qty < 1 ||
    !Number.isSafeInteger(l.priceKobo) ||
    l.priceKobo < 0
  )
    return lines;
  const ex = lines.find((x) => x.variantId === l.variantId);
  return ex
    ? lines.map((x) =>
        x.variantId === l.variantId ? { ...x, qty: Math.min(99, x.qty + l.qty) } : x,
      )
    : lines.length < 50
      ? [...lines, { ...l, qty: Math.min(99, l.qty) }]
      : lines;
}
export function restoreCart(raw: unknown, products: Product[]): CartLine[] {
  const parsed = persisted.safeParse(raw);
  if (!parsed.success) return [];
  const result: CartLine[] = [];
  for (const l of parsed.data) {
    const p = products.find((p) => p.variants.some((v) => v.id === l.variantId));
    const v = p?.variants.find((v) => v.id === l.variantId);
    if (!p || !v || v.stock == null || v.stock <= 0) continue;
    const line = {
      productId: p.id,
      variantId: v.id,
      name: p.name,
      variantLabel: [v.size, v.color].filter(Boolean).join(" · "),
      priceKobo: v.priceKobo,
      qty: Math.min(l.qty, v.stock, 99),
      imageUrl: p.images[0]?.url,
    };
    if (!result.some((x) => x.variantId === line.variantId)) result.push(line);
  }
  return result;
}
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        await apiCall("/me");
        const [products, remote] = await Promise.all([
          apiCall<Product[]>("/products"),
          apiCall<unknown[]>("/cart"),
        ]);
        let local: unknown = [];
        try {
          local = JSON.parse(localStorage.getItem(KEY) ?? "[]");
        } catch {
          /* corrupt or unavailable storage */
        }
        const restored = restoreCart(local, products);
        const saved = restoreCart(remote, products);
        const combined = [
          ...restored,
          ...saved.filter((l) => !restored.some((x) => x.variantId === l.variantId)),
        ];
        if (active) {
          setLines(combined);
          setReady(true);
        }
      } catch {
        if (active) setReady(true);
      }
    }
    void restore();
    window.addEventListener("afnan-auth", restore);
    return () => {
      active = false;
      window.removeEventListener("afnan-auth", restore);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* Cart remains usable when browser storage is unavailable. */
    }
    const timer = setTimeout(() => {
      void apiCall("/cart", {
        method: "PUT",
        body: JSON.stringify(lines.map(({ variantId, qty }) => ({ variantId, qty }))),
      }).catch(() => {
        /* Local state remains available; checkout always revalidates. */
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [lines, ready]);
  const value = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotalKobo: lines.reduce((n, l) => n + l.qty * l.priceKobo, 0),
      add: (l) => setLines((s) => cartReducerAdd(s, l)),
      setQty: (id, qty) => {
        if (!Number.isInteger(qty)) return;
        setLines((s) =>
          qty <= 0
            ? s.filter((l) => l.variantId !== id)
            : s.map((l) => (l.variantId === id ? { ...l, qty: Math.min(qty, 99) } : l)),
        );
      },
      remove: (id) => setLines((s) => s.filter((l) => l.variantId !== id)),
      clear: () => setLines([]),
    }),
    [lines],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
