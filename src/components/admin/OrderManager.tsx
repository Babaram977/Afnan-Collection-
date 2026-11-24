import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectionList } from "@/components/site/SelectionList";
import { parseSelections } from "@/lib/order-lines";
interface StaffOrder {
  id: string;
  reference?: string | null;
  payment_method?: string;
  status: string;
  total_kobo: number;
  customer: string;
  address: string;
  created_at: number;
  items?: {
    name: string;
    sku: string;
    qty: number;
    price_kobo: number;
    selections?: string | null;
  }[];
  /** Recorded bank-transfer decision; the verifier is joined from the approving account. */
  bankTransferApproval?: {
    amount_kobo: number;
    bank_reference: string;
    outcome: "paid" | "late_review";
    approved_by: string;
    approved_at: number;
    verifier_name: string | null;
    verifier_email: string | null;
  } | null;
}
const nigeriaTime = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });
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
      <h2 className="text-lg font-medium">Customer orders</h2>
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
          // The open order stays in view after its status changes past the filter.
          .filter((o) => !filter || o.status === filter || o.id === detail?.id)
          .map((o) => (
            <li key={o.id} className="space-y-3 rounded-xl border bg-card p-4">
              <h3 className="break-all font-semibold">Order {o.reference ?? o.id}</h3>
              {o.reference && (
                <p className="break-all text-xs text-muted-foreground">Internal ID: {o.id}</p>
              )}
              <p>
                {JSON.parse(o.customer).name} · {o.status} · {formatNaira(o.total_kobo)}
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    if (detail?.id === o.id) {
                      setDetail(null);
                    } else {
                      setDetail(await apiCall(`/admin/orders/${o.id}`));
                    }
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
                aria-expanded={detail?.id === o.id}
              >
                {detail?.id === o.id ? "Hide order details" : "View purchased items and delivery"}
              </Button>
              {detail?.id === o.id && (
                <section className="space-y-4 border-t pt-4">
                  <h3 className="break-all text-base font-medium">
                    Order {detail.reference ?? detail.id}
                  </h3>
                  {detail.reference && (
                    <p className="break-all text-xs text-muted-foreground">
                      Internal ID: {detail.id}
                    </p>
                  )}
                  <p>Status: {detail.status}</p>
                  <p>
                    {customer.name} · {customer.phone} · {customer.email}
                  </p>
                  <address className="not-italic">
                    {address.street}, {address.city}, {address.state}
                  </address>
                  <ul>
                    {detail.items?.map((i) => (
                      <li key={i.sku} data-order-item>
                        {i.qty} × {i.name} ({i.sku}) — {formatNaira(i.price_kobo * i.qty)}
                        <SelectionList selections={parseSelections(i.selections)} />
                      </li>
                    ))}
                  </ul>
                  <p className="font-bold">Total: {formatNaira(detail.total_kobo)}</p>
                  {detail.bankTransferApproval && (
                    <section
                      aria-label="Payment verification"
                      data-payment-verification
                      className="space-y-1 rounded-lg border p-3 text-sm"
                    >
                      <h4 className="font-semibold">
                        {detail.bankTransferApproval.outcome === "paid"
                          ? "Payment verification"
                          : "Late payment recorded for review"}
                      </h4>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt>Verified by</dt>
                        <dd data-verified-by className="break-all">
                          {detail.bankTransferApproval.verifier_name ||
                            detail.bankTransferApproval.verifier_email ||
                            detail.bankTransferApproval.approved_by}
                        </dd>
                        <dt>Staff account</dt>
                        <dd data-staff-account className="break-all">
                          {detail.bankTransferApproval.verifier_email ??
                            detail.bankTransferApproval.approved_by}
                        </dd>
                        <dt>Amount verified</dt>
                        <dd>{formatNaira(detail.bankTransferApproval.amount_kobo)}</dd>
                        <dt>Bank transaction reference</dt>
                        <dd data-bank-reference className="break-all">
                          {detail.bankTransferApproval.bank_reference}
                        </dd>
                        <dt>Verified at</dt>
                        <dd data-verified-at>
                          {nigeriaTime(detail.bankTransferApproval.approved_at)} (Nigeria)
                        </dd>
                      </dl>
                    </section>
                  )}
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
            </li>
          ))}
      </ul>
      {!orders.length && <p>No orders yet.</p>}
    </section>
  );
}
