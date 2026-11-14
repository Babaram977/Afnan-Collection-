import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart";
import { formatNaira } from "@/lib/catalog";
import { apiCall, type Zone, type Order, type Me } from "@/lib/store";
import { PageHeader } from "@/components/site/PageHeader";
export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Afnan Collection Online" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});
function Checkout() {
  const { lines, subtotalKobo, clear } = useCart();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [payment, setPayment] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState(false);
  const [addresses, setAddresses] = useState<{ id: string; label: string; data: string }[]>([]);
  useEffect(() => {
    setKey(crypto.randomUUID());
    Promise.all([
      apiCall<{ checkoutEnabled: boolean; paymentsEnabled: boolean }>("/health"),
      apiCall<Zone[]>("/zones"),
      apiCall<Me>("/me"),
    ])
      .then(([h, z, m]) => {
        setEnabled(h.checkoutEnabled);
        setPayment(h.paymentsEnabled);
        setZones(z);
        setEmail(m.email ?? "");
        setAccountEmail(Boolean(m.email));
        if (m.userId)
          void apiCall<typeof addresses>("/addresses")
            .then(setAddresses)
            .catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, []);
  const zone = zones.find((z) => z.id === zoneId);
  return (
    <>
      <PageHeader
        title="Checkout"
        intro="Prices and availability are checked when your order is prepared."
      />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
        {order ? (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Order prepared</h2>
            <p>Reference: {order.id}</p>
            <p>Total: {formatNaira(order.total_kobo)}</p>
            <p>
              Awaiting payment. Items are reserved for 30 minutes. Payment is confirmed only after
              server verification.
            </p>
            <p>
              <Link to="/account" className="underline">
                Track your order
              </Link>
              . Guest tracking is available on this browser.
            </p>
            {payment ? (
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const p = await apiCall<{ authorization_url: string }>(
                      `/orders/${order.id}/pay`,
                      { method: "POST", body: "{}" },
                    );
                    const target = new URL(p.authorization_url);
                    if (
                      target.origin !== window.location.origin &&
                      target.origin !== "https://checkout.paystack.com"
                    )
                      throw new Error("Unexpected payment URL");
                    window.location.assign(target.href);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Continue to payment
              </Button>
            ) : (
              <p role="status">Payments are disabled. No charge has been made.</p>
            )}
          </section>
        ) : (
          <form
            className="space-y-5 rounded-2xl bg-card p-6 shadow-soft"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = new FormData(e.currentTarget);
              try {
                const payload = {
                  zoneId,
                  lines: lines.map(({ variantId, qty }) => ({ variantId, qty })),
                  customer: { name: form.get("name"), phone: form.get("phone"), email },
                  address: {
                    street: form.get("street"),
                    city: form.get("city"),
                    state: zone?.state,
                  },
                };
                const fingerprint = Array.from(
                  new Uint8Array(
                    await crypto.subtle.digest(
                      "SHA-256",
                      new TextEncoder().encode(JSON.stringify(payload)),
                    ),
                  ),
                  (b) => b.toString(16).padStart(2, "0"),
                ).join("");
                let requestKey = key;
                try {
                  const prior = JSON.parse(sessionStorage.getItem("afnan-order-attempt") ?? "null");
                  requestKey = prior?.fingerprint === fingerprint ? prior.key : crypto.randomUUID();
                  sessionStorage.setItem(
                    "afnan-order-attempt",
                    JSON.stringify({ fingerprint, key: requestKey }),
                  );
                } catch {
                  /* The in-memory key still protects retries when storage is unavailable. */
                }
                const o = await apiCall<Order>("/orders", {
                  method: "POST",
                  body: JSON.stringify({ ...payload, idempotencyKey: requestKey }),
                });
                setOrder(o);
                clear();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {!enabled && (
              <p role="status" className="rounded-xl bg-warning p-4 text-warning-foreground">
                Ordering is not enabled. No real orders or payments can be submitted.
              </p>
            )}
            <div>
              <Label htmlFor="co-name">Full name</Label>
              <Input id="co-name" name="name" autoComplete="name" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="co-phone">Phone</Label>
              <Input
                id="co-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                minLength={7}
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="co-email">Email</Label>
              <Input
                id="co-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                readOnly={accountEmail}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {addresses.length > 0 && (
              <div>
                <Label htmlFor="co-saved">Saved address</Label>
                <select
                  id="co-saved"
                  className="min-h-11 w-full rounded-lg border bg-card px-3"
                  defaultValue=""
                  onChange={(e) => {
                    const chosen = addresses.find((a) => a.id === e.target.value);
                    if (!chosen) return;
                    const address = JSON.parse(chosen.data);
                    const form = e.currentTarget.form;
                    for (const name of ["street", "city"]) {
                      const input = form?.elements.namedItem(name);
                      if (input instanceof HTMLInputElement) input.value = address[name];
                    }
                    setZoneId(
                      zones.find(
                        (z) => z.state.toLowerCase() === String(address.state).toLowerCase(),
                      )?.id ?? "",
                    );
                  }}
                >
                  <option value="">Choose a saved address</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="co-street">Street address</Label>
              <Input
                id="co-street"
                name="street"
                autoComplete="street-address"
                minLength={5}
                maxLength={500}
                required
              />
            </div>
            <div>
              <Label htmlFor="co-city">City</Label>
              <Input id="co-city" name="city" autoComplete="address-level2" required />
            </div>
            <div>
              <Label htmlFor="co-zone">Delivery area</Label>
              <select
                id="co-zone"
                className="h-11 w-full rounded-lg border bg-card px-3"
                required
                value={zoneId}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              >
                <option value="">
                  {zones.length ? "Select your area" : "Delivery not configured"}
                </option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}, {z.state} — {formatNaira(z.fee_kobo)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={!enabled || !zone || !lines.length || busy}
              type="submit"
              className="w-full rounded-full"
            >
              {busy ? "Preparing…" : "Prepare order"}
            </Button>
          </form>
        )}
        <aside className="h-fit rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Summary</h2>
          {lines.map((l) => (
            <p key={l.variantId} className="mt-2 text-sm">
              {l.qty} × {l.name} — {formatNaira(l.qty * l.priceKobo)}
            </p>
          ))}
          <p className="mt-4">Subtotal: {formatNaira(subtotalKobo)}</p>
          <p>Delivery: {zone ? formatNaira(zone.fee_kobo) : "Choose an area"}</p>
          <p className="mt-2 font-bold">
            Estimated total: {formatNaira(subtotalKobo + (zone?.fee_kobo ?? 0))}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Final total is calculated on the server.
          </p>
        </aside>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
