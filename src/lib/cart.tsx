import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

export function cartReducerAdd(lines: CartLine[], l: CartLine): CartLine[] {
  const ex = lines.find((x) => x.variantId === l.variantId);
  return ex
    ? lines.map((x) => (x.variantId === l.variantId ? { ...x, qty: x.qty + l.qty } : x))
    : [...lines, l];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, ready]);
  const value = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotalKobo: lines.reduce((n, l) => n + l.qty * l.priceKobo, 0),
      add: (l) => setLines((s) => cartReducerAdd(s, l)),
      setQty: (id, qty) =>
        setLines((s) =>
          qty <= 0
            ? s.filter((x) => x.variantId !== id)
            : s.map((x) => (x.variantId === id ? { ...x, qty } : x)),
        ),
      remove: (id) => setLines((s) => s.filter((x) => x.variantId !== id)),
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
