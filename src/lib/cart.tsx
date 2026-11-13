import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
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
  ready: boolean;
  error: string | null;
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
function saveLocal(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* Storage can be disabled; the server copy still syncs when connected. */
  }
}
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<CartLine[]>([]);
  const readyRef = useRef(false);
  const commit = useCallback((change: (previous: CartLine[]) => CartLine[]) => {
    if (!readyRef.current) return;
    const next = change(current.current);
    current.current = next;
    saveLocal(next);
    setLines(next);
  }, []);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function restore(event?: Event) {
      const attempt = ++generation;
      readyRef.current = false;
      setReady(false);
      setError(null);
      try {
        await apiCall("/me");
        const [products, remote] = await Promise.all([
          apiCall<Product[]>("/products"),
          apiCall<unknown[]>("/cart"),
        ]);
        let local: unknown = null;
        let present = false;
        try {
          const raw = localStorage.getItem(KEY);
          if (raw !== null) {
            local = JSON.parse(raw);
            present = persisted.safeParse(local).success;
          }
        } catch {
          /* Invalid/unavailable snapshots fall back to the owner-scoped server copy. */
        }
        const restored = restoreCart(local, products);
        const saved = restoreCart(remote, products);
        // A valid device snapshot, including an empty one, represents explicit local
        // removals. Do not resurrect stale remote lines while a debounced PUT is pending.
        const combined = !present
          ? saved
          : event
            ? [
                ...restored,
                ...saved.filter((l) => !restored.some((x) => x.variantId === l.variantId)),
              ]
            : restored;
        if (active && attempt === generation) {
          current.current = combined;
          saveLocal(combined);
          setLines(combined);
          readyRef.current = true;
          setReady(true);
        }
      } catch {
        if (active && attempt === generation)
          setError(
            "Cart unavailable. Refresh to try again. Your saved items have not been changed.",
          );
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
    const timer = setTimeout(() => {
      void apiCall("/cart", {
        method: "PUT",
        body: JSON.stringify(lines.map(({ variantId, qty }) => ({ variantId, qty }))),
      }).catch(() => {
        /* Local edits remain saved; checkout always revalidates authoritative data. */
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [lines, ready]);
  const value = useMemo<CartCtx>(
    () => ({
      lines,
      ready,
      error,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotalKobo: lines.reduce((n, l) => n + l.qty * l.priceKobo, 0),
      add: (l) => commit((previous) => cartReducerAdd(previous, l)),
      setQty: (id, qty) => {
        if (!Number.isInteger(qty)) return;
        commit((previous) =>
          qty <= 0
            ? previous.filter((l) => l.variantId !== id)
            : previous.map((l) => (l.variantId === id ? { ...l, qty: Math.min(qty, 99) } : l)),
        );
      },
      remove: (id) => commit((previous) => previous.filter((l) => l.variantId !== id)),
      clear: () => commit(() => []),
    }),
    [lines, ready, error, commit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
