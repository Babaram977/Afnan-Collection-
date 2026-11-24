import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart";
import { lineKey } from "@/lib/options";
import { formatNaira } from "@/lib/catalog";
import { apiCall, type Order, type Me } from "@/lib/store";
import { PageHeader } from "@/components/site/PageHeader";
import { business } from "@/lib/business";
import { afnanDelivery } from "@/lib/delivery-policy";
import { BankTransferInstructions, OrderSummary } from "@/components/site/OrderDetails";
import { rememberOrder } from "@/lib/order-status";
export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Afnan Collection Online" }, { name: "robots", content: "noindex" }],
  }),
  component: Checkout,
});
function Checkout() {
  const { lines, subtotalKobo, clear } = useCart();
  const [fulfilmentMethod, setFulfilmentMethod] = useState<"delivery" | "pickup">("delivery");
  const [stateName, setStateName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [payment, setPayment] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [accountEmail, setAccountEmail] = useState(false);
  useEffect(() => {
    setKey(crypto.randomUUID());
    // On a slow connection a customer can type before the page becomes interactive. Keep what
    // they typed in the two controlled fields instead of resetting them to empty state.
    const typed = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? "";
    const typedEmail = typed("co-email");
    const typedState = typed("co-state");
    if (typedEmail) setEmail((current) => current || typedEmail);
    if (typedState) setStateName((current) => current || typedState);
    Promise.all([
      apiCall<{ checkoutEnabled: boolean; paymentsEnabled: boolean }>("/health"),
      apiCall<Me>("/me"),
    ])
      .then(([h, m]) => {
        setEnabled(h.checkoutEnabled);
        setPayment(h.paymentsEnabled);
        // A staff member may shop while signed into the admin dashboard in this browser.
        // Never prefill the admin's identity into a customer's checkout.
        const customerEmail = m.role === "admin" || m.role === "staff" ? null : m.email;
        setEmail((current) => current || customerEmail || "");
        setAccountEmail(Boolean(customerEmail));
      })
      .catch((e) => setError(e.message));
  }, []);
  const quote =
    fulfilmentMethod === "pickup"
      ? afnanDelivery(subtotalKobo, "pickup", "")
      : stateName.trim()
        ? afnanDelivery(subtotalKobo, "delivery", stateName)
        : null;
  return (
    <>
      <PageHeader
        title="Checkout"
        intro="Prices and availability are checked when your order is prepared."
      />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        {order ? (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Order prepared</h2>
            <p>
              Order reference:{" "}
              <strong className="tracking-wide">{order.reference ?? order.id}</strong>
            </p>
            <p>Total payable to Afnan: {formatNaira(order.total_kobo)}</p>
            {order.payment_method === "bank_transfer" ? (
              <BankTransferInstructions order={order} />
            ) : (
              <p>
                Awaiting payment. Items are reserved for 30 minutes. Payment is confirmed only after
                server verification.
              </p>
            )}
            <p className="flex flex-wrap gap-x-5 gap-y-2">
              {/* The order is saved on the server; this page survives a refresh or a closed tab. */}
              <Link to="/order/$id" params={{ id: order.id }} className="font-semibold underline">
                Track this order
              </Link>
              <Link to="/shop" className="underline">
                Continue shopping
              </Link>
            </p>
            {order.payment_method === "bank_transfer" ? null : payment ? (
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
                  fulfilmentMethod,
                  // Each cart line keeps its own selection (colour, size, note); the server groups
                  // lines of the same item without merging different selections.
                  lines: lines.map(({ variantId, qty, note }) => ({
                    variantId,
                    qty,
                    ...(note ? { note } : {}),
                  })),
                  customer: { name: form.get("name"), phone: form.get("phone"), email },
                  ...(fulfilmentMethod === "delivery"
                    ? {
                        address: {
                          street: form.get("street"),
                          city: form.get("city"),
                          state: stateName,
                        },
                      }
                    : {}),
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
                // Remember the order on this device before clearing the cart, so it can always be
                // reopened from /orders even if this page is closed.
                rememberOrder(o.id);
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

            <fieldset className="space-y-3 rounded-xl border p-4">
              <legend className="font-semibold">How would you like to receive your order?</legend>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="fulfilmentMethod"
                  value="delivery"
                  checked={fulfilmentMethod === "delivery"}
                  onChange={() => setFulfilmentMethod("delivery")}
                />
                Delivery
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="fulfilmentMethod"
                  value="pickup"
                  checked={fulfilmentMethod === "pickup"}
                  onChange={() => setFulfilmentMethod("pickup")}
                />
                Store pickup — FREE
              </label>
            </fieldset>
            {fulfilmentMethod === "delivery" ? (
              <>
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
                  <Label htmlFor="co-state">State</Label>
                  <Input
                    id="co-state"
                    name="state"
                    autoComplete="address-level1"
                    required
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                  />
                </div>
                <p className="text-sm">
                  Within Kano: ₦1,500 delivery below ₦250,000; free at ₦250,000 or more. Outside
                  Kano: transport company determines and collects its fee directly, separate from
                  your Afnan payment.
                </p>
              </>
            ) : (
              <p className="text-sm">
                Store pickup is free at every order amount. Collection location and time will be
                confirmed by our team.
              </p>
            )}
            <Button
              disabled={
                !enabled ||
                (fulfilmentMethod === "delivery" && !stateName.trim()) ||
                !lines.length ||
                busy
              }
              type="submit"
              className="w-full rounded-full"
            >
              {busy ? "Preparing…" : "Prepare order"}
            </Button>
          </form>
        )}
        <aside className="h-fit rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Summary</h2>
          {order ? (
            <OrderSummary order={order} />
          ) : (
            <>
              {lines.map((l) => (
                <p key={lineKey(l)} className="mt-2 text-sm">
                  {l.qty} × {l.name} — {formatNaira(l.qty * l.priceKobo)}
                </p>
              ))}
              <p className="mt-4">Subtotal: {formatNaira(subtotalKobo)}</p>
              <p>
                {fulfilmentMethod === "pickup" ? "Store pickup" : "Delivery"}:{" "}
                {quote
                  ? quote.carrierDirect
                    ? "Paid directly to transport company"
                    : formatNaira(quote.feeKobo)
                  : "Enter your state"}
              </p>
              <p className="mt-2 font-bold">
                Estimated payable to Afnan: {formatNaira(subtotalKobo + (quote?.feeKobo ?? 0))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Final total is calculated on the server. Any interstate transport fee is separate
                and paid directly to the logistics company.
              </p>
            </>
          )}
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
