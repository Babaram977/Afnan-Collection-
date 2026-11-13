import { createFileRoute, Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/catalog";
import { PageHeader } from "@/components/site/PageHeader";
import { NotConnected } from "@/components/site/StatusBadge";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Afnan Collection Online" }, { name: "description", content: "Checkout for Afnan Collection Online." }, { property: "og:title", content: "Checkout — Afnan Collection Online" }, { property: "og:description", content: "Checkout for Afnan Collection Online." }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

function Checkout() {
  const { lines, subtotalKobo } = useCart();
  return (
    <>
      <PageHeader title="Checkout"><div className="mt-3"><NotConnected label="Online ordering not available yet" /></div></PageHeader>
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        <form className="space-y-6 rounded-2xl bg-card p-6 shadow-soft" onSubmit={(e) => e.preventDefault()} aria-describedby="co-note">
          <div id="co-note" role="note" className="flex gap-3 rounded-xl bg-warning p-4 text-sm text-warning-foreground"><Info className="size-5 shrink-0" aria-hidden />Orders and payments are not connected yet. Nothing you enter here is sent or saved.</div>
          <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-2 font-display text-lg font-semibold">Contact</legend>
            <div><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" className="mt-1.5 h-11" /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" autoComplete="tel" className="mt-1.5 h-11" /></div>
            <div className="sm:col-span-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5 h-11" /></div>
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-2 font-display text-lg font-semibold">Delivery address</legend>
            <div className="sm:col-span-2"><Label htmlFor="addr">Street address</Label><Textarea id="addr" autoComplete="street-address" className="mt-1.5" /></div>
            <div><Label htmlFor="city">City</Label><Input id="city" autoComplete="address-level2" className="mt-1.5 h-11" /></div>
            <div><Label htmlFor="state">State</Label><Input id="state" autoComplete="address-level1" className="mt-1.5 h-11" /></div>
          </fieldset>
          <fieldset><legend className="mb-2 font-display text-lg font-semibold">Payment</legend><p className="text-sm text-muted-foreground">Payment methods will appear here once a payment provider is connected.</p></fieldset>
          <Button type="submit" size="lg" disabled className="w-full rounded-full">Place order — not available yet</Button>
        </form>
        <aside className="h-fit rounded-2xl bg-card p-6 shadow-soft" aria-label="Order summary">
          <h2 className="text-lg font-semibold">Summary</h2>
          {lines.length ? <ul className="mt-3 space-y-2 text-sm">{lines.map((l) => <li key={l.variantId} className="flex justify-between gap-2"><span>{l.qty} × {l.name}</span><span>{formatNaira(l.qty * l.priceKobo)}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Your cart is empty. <Link to="/shop" search={{}} className="font-semibold text-primary underline">Browse the shop</Link></p>}
          <div className="mt-4 flex justify-between border-t pt-4 font-semibold"><span>Subtotal</span><span>{formatNaira(subtotalKobo)}</span></div>
        </aside>
      </div>
    </>
  );
}
