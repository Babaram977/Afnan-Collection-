import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/catalog";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { ProductImageOrPlaceholder } from "@/components/site/ProductCard";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — Afnan Collection Online" },
      { name: "description", content: "Review the items in your cart." },
      { property: "og:title", content: "Cart — Afnan Collection Online" },
      { property: "og:description", content: "Review the items in your cart." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { lines, setQty, remove, subtotalKobo, ready, error } = useCart();
  if (!ready)
    return (
      <>
        <PageHeader title="Your cart" />
        <div className="container-page py-8">
          <p role={error ? "alert" : "status"}>{error ?? "Loading your saved cart…"}</p>
        </div>
      </>
    );
  return (
    <>
      <PageHeader title="Your cart" intro="Prices and availability are checked at checkout." />
      <div className="container-page py-8">
        {!lines.length ? (
          <EmptyState
            title="Your cart is empty"
            icon={<ShoppingBag className="size-7" />}
            action={
              <Button asChild>
                <Link to="/shop" search={{}}>
                  Start shopping
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <ul className="divide-y rounded-2xl bg-card shadow-soft">
              {lines.map((l) => (
                <li key={l.variantId} className="flex gap-4 p-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl">
                    <ProductImageOrPlaceholder src={l.imageUrl} alt={l.name} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{l.name}</p>
                    {l.variantLabel && (
                      <p className="text-sm text-muted-foreground">{l.variantLabel}</p>
                    )}
                    <p className="mt-1 text-sm font-bold">{formatNaira(l.priceKobo)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Decrease ${l.name}`}
                        onClick={() => setQty(l.variantId, l.qty - 1)}
                      >
                        <Minus />
                      </Button>
                      <span aria-live="polite" className="w-6 text-center font-semibold">
                        {l.qty}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Increase ${l.name}`}
                        onClick={() => setQty(l.variantId, l.qty + 1)}
                      >
                        <Plus />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${l.name}`}
                        onClick={() => remove(l.variantId)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit rounded-2xl bg-card p-6 shadow-soft">
              <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{formatNaira(subtotalKobo)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery fees are not yet configured.
              </p>
              <Button asChild className="mt-6 w-full rounded-full">
                <Link to="/checkout">Continue to checkout</Link>
              </Button>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
