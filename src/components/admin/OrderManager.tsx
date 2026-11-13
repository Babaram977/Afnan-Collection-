import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
interface StaffOrder {
  id: string;
  status: string;
  total_kobo: number;
  customer: string;
  address: string;
  created_at: number;
  items?: { name: string; sku: string; qty: number; price_kobo: number }[];
}
export function OrderManager() {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [detail, setDetail] = useState<StaffOrder | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      apiCall<StaffOrder[]>("/admin/orders")
        .then(setOrders)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const next: Record<string, { status: string; label: string }> = {
    pending: { status: "cancelled", label: "Cancel unpaid reservation" },
    paid: { status: "processing", label: "Start fulfilment" },
    processing: { status: "shipped", label: "Mark dispatched" },
    shipped: { status: "delivered", label: "Mark delivered" },
  };
  const customer = detail ? JSON.parse(detail.customer) : null;
  const address = detail ? JSON.parse(detail.address) : null;
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Customer orders</h2>
      {error && <p role="alert">{error}</p>}
      <div>
        <Label htmlFor="order-filter">Show orders</Label>
        <select
          id="order-filter"
          className="ml-3 min-h-11 rounded-lg border bg-card px-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "pending",
            "paid",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "expired",
            "refund_pending",
            "refunded",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {orders
          .filter((o) => !filter || o.status === filter)
          .map((o) => (
            <li key={o.id} className="space-y-3 rounded-2xl bg-card p-5 shadow-soft">
              <h3 className="break-all font-semibold">Order {o.id}</h3>
              <p>
                {JSON.parse(o.customer).name} · {o.status} · {formatNaira(o.total_kobo)}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setDetail(await apiCall(`/admin/orders/${o.id}`));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                View purchased items and delivery
              </Button>
            </li>
          ))}
      </ul>
      {!orders.length && <p>No orders yet.</p>}
      {detail && (
        <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
          <h3 className="break-all text-xl font-semibold">Order {detail.id}</h3>
          <p>Status: {detail.status}</p>
          <p>
            {customer.name} · {customer.phone} · {customer.email}
          </p>
          <address className="not-italic">
            {address.street}, {address.city}, {address.state}
          </address>
          <ul>
            {detail.items?.map((i) => (
              <li key={i.sku}>
                {i.qty} × {i.name} ({i.sku}) — {formatNaira(i.price_kobo * i.qty)}
              </li>
            ))}
          </ul>
          <p className="font-bold">Total: {formatNaira(detail.total_kobo)}</p>
          {next[detail.status] && (
            <Button
              disabled={busy}
              onClick={async () => {
                const transition = next[detail.status];
                if (!transition) return;
                if (
                  transition.status === "cancelled" &&
                  !window.confirm("Cancel this unpaid order and release reserved stock?")
                )
                  return;
                setBusy(true);
                try {
                  await apiCall(`/admin/orders/${detail.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: transition.status }),
                  });
                  setDetail(await apiCall(`/admin/orders/${detail.id}`));
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {next[detail.status]?.label}
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
