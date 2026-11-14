import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { SignIn } from "@/components/site/SignIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall, type Me, type Order } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — Afnan Collection Online" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});
function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detail, setDetail] = useState<
    (Order & { items: { name: string; qty: number; price_kobo: number }[] }) | null
  >(null);
  const [addresses, setAddresses] = useState<{ id: string; label: string; data: string }[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const m = await apiCall<Me>("/me");
      setMe(m);
      setOrders(await apiCall<Order[]>("/orders"));
      if (m.userId) setAddresses(await apiCall("/addresses"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(path: string, body: object = {}) {
    try {
      await apiCall(path, { method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeader title="Your account" intro="Sign in, manage addresses and follow your orders." />
      <div className="container-page space-y-8 py-8">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {!me?.userId ? (
          <SignIn
            onSignedIn={() => {
              window.dispatchEvent(new Event("afnan-auth"));
              void load();
            }}
          />
        ) : (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <h2 className="text-xl font-semibold">Signed in as {me.email}</h2>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await apiCall("/profile", {
                    method: "PATCH",
                    body: JSON.stringify({ name: f.get("name") }),
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <div>
                <Label htmlFor="profile-name">Your name</Label>
                <Input id="profile-name" name="name" required maxLength={200} />
              </div>
              <Button>Update name</Button>
            </form>
            <Button
              variant="outline"
              onClick={async () => {
                await action("/auth/sign-out");
                setAddresses([]);
                window.dispatchEvent(new Event("afnan-auth"));
              }}
            >
              Sign out
            </Button>
          </section>
        )}
        <section className="rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="text-2xl font-semibold">Orders</h2>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>
            Refresh order status
          </Button>
          {!me?.userId && (
            <p className="mt-2 text-sm text-muted-foreground">
              Guest orders are visible only on the browser where they were prepared.
            </p>
          )}
          {!orders.length ? (
            <p className="mt-4">No orders yet.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-4">
                  <button
                    className="break-all text-left font-semibold text-primary underline"
                    onClick={async () => {
                      try {
                        setDetail(await apiCall(`/orders/${o.id}`));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {o.id}
                  </button>
                  <span>{o.status}</span>
                  <span>{formatNaira(o.total_kobo)}</span>
                  {o.status === "pending" && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const p = await apiCall<{ authorization_url: string }>(
                            `/orders/${o.id}/pay`,
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
                        }
                      }}
                    >
                      Continue to payment
                    </Button>
                  )}
                  {o.status === "pending" && (
                    <Button variant="outline" onClick={() => void action(`/orders/${o.id}/cancel`)}>
                      Cancel reservation
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {detail && (
            <div className="mt-4 rounded-xl bg-secondary p-4">
              <h3 className="font-semibold">Order {detail.id}</h3>
              <p>Status: {detail.status}</p>
              {detail.items.map((i, n) => (
                <p key={n}>
                  {i.qty} × {i.name} — {formatNaira(i.price_kobo * i.qty)}
                </p>
              ))}
              <p>Total: {formatNaira(detail.total_kobo)}</p>
            </div>
          )}
        </section>
        {me?.userId && (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <h2 className="text-2xl font-semibold">Saved addresses</h2>
            {addresses.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3">
                <p>
                  {a.label}: {Object.values(JSON.parse(a.data)).join(", ")}
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await apiCall(`/addresses/${a.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                await action("/addresses", {
                  label: f.get("label"),
                  address: { street: f.get("street"), city: f.get("city"), state: f.get("state") },
                });
                form.reset();
              }}
            >
              {[
                ["label", "Label"],
                ["street", "Street address"],
                ["city", "City"],
                ["state", "State"],
              ].map(([name, label]) => (
                <div key={name}>
                  <Label htmlFor={`address-${name}`}>{label}</Label>
                  <Input
                    id={`address-${name}`}
                    name={name}
                    required
                    minLength={name === "street" ? 5 : 1}
                  />
                </div>
              ))}
              <Button>Save address</Button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
