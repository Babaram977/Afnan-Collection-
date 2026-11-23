import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { chosenLabel, lineKey } from "@/lib/options";
import { useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
import { FREE_DELIVERY_THRESHOLD_KOBO, KANO_DELIVERY_KOBO } from "@/lib/delivery-policy";
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
  // null while loading; checkout stays unavailable until the server says it is enabled.
  const [checkoutEnabled, setCheckoutEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    apiCall<{ checkoutEnabled: boolean }>("/health")
      .then((h) => setCheckoutEnabled(h.checkoutEnabled))
      .catch(() => setCheckoutEnabled(false));
  }, []);
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
            <ul className="min-w-0 divide-y rounded-2xl bg-card shadow-soft">
              {lines.map((l) => (
                <li key={lineKey(l)} className="flex gap-4 p-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-xl">
                    <ProductImageOrPlaceholder src={l.imageUrl} alt={l.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{l.name}</p>
                    {chosenLabel(l.variantLabel) && (
                      <p className="break-words text-sm text-muted-foreground">
                        {chosenLabel(l.variantLabel)}
                      </p>
                    )}
                    {l.note && (
                      <p className="break-words text-sm" data-cart-note>
                        {l.note}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-bold">{formatNaira(l.priceKobo)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Decrease ${l.name}`}
                        onClick={() => setQty(lineKey(l), l.qty - 1)}
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
                        onClick={() => setQty(lineKey(l), l.qty + 1)}
                      >
                        <Plus />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${l.name}`}
                        onClick={() => remove(lineKey(l))}
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
              {/* Approved delivery policy, from the same constants the server prices with. */}
              <div className="mt-3 space-y-1 text-xs text-muted-foreground" data-delivery-policy>
                <p className="font-medium text-foreground">Delivery</p>
                <p>
                  Within Kano: {formatNaira(KANO_DELIVERY_KOBO)}, free on orders from{" "}
                  {formatNaira(FREE_DELIVERY_THRESHOLD_KOBO)}
                </p>
                <p>Store pickup: free</p>
                <p>Outside Kano: paid directly to the transport company</p>
                <p data-free-delivery-note>
                  {subtotalKobo >= FREE_DELIVERY_THRESHOLD_KOBO
                    ? "This order qualifies for free delivery within Kano."
                    : `Add ${formatNaira(FREE_DELIVERY_THRESHOLD_KOBO - subtotalKobo)} more for free delivery within Kano.`}
                </p>
                <p>Your delivery choice and final total are confirmed at checkout.</p>
              </div>
              {checkoutEnabled ? (
                <Button asChild className="mt-6 w-full rounded-full">
                  <Link to="/checkout">Continue to checkout</Link>
                </Button>
              ) : (
                <>
                  <p
                    role="status"
                    data-checkout-unavailable
                    className="mt-6 rounded-xl bg-secondary p-3 text-sm"
                  >
                    {checkoutEnabled === null
                      ? "Checking checkout availability…"
                      : "Checkout is temporarily unavailable while we prepare the store. Your cart is saved on this device."}
                  </p>
                  <Button className="mt-3 w-full rounded-full" disabled>
                    Checkout coming soon
                  </Button>
                </>
              )}
              <Button asChild variant="outline" className="mt-3 w-full rounded-full">
                <Link to="/shop" search={{}}>
                  Continue shopping
                </Link>
              </Button>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
