import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/PageHeader";
import {
  BankTransferInstructions,
  OrderSummary,
  WhatsAppReceiptButton,
} from "@/components/site/OrderDetails";
import { ReceiptUpload } from "@/components/site/ReceiptUpload";
import { formatNaira } from "@/lib/catalog";
import { customerOrderStatus, rememberOrder } from "@/lib/order-status";
import { apiCall, type Order } from "@/lib/store";

export const Route = createFileRoute("/order/$id")({
  head: () => ({
    meta: [
      { title: "Your order — Afnan Collection Online" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

type TrackedOrder = Order & {
  status: string;
  paymentStatus?: string | null;
  receipts?: { id: string; status: string; review_note: string | null }[];
};

const toneClass: Record<string, string> = {
  waiting: "bg-secondary text-secondary-foreground",
  review: "bg-warning text-warning-foreground",
  good: "bg-primary text-primary-foreground",
  problem: "bg-destructive text-destructive-foreground",
  closed: "bg-muted text-foreground",
};

/**
 * A customer's order, reopened with the guest-order cookie of the browser that placed it (the
 * server returns 404 to anyone else, even with the id). Status comes from the saved order only.
 */
function OrderPage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await apiCall<TrackedOrder>(`/orders/${encodeURIComponent(id)}`);
      setOrder(o);
      setError("");
      rememberOrder(o.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const status = order ? customerOrderStatus(order) : null;
  const rejected = order?.receipts?.find((r) => r.status === "rejected" && r.review_note);
  return (
    <>
      <PageHeader title="Your order" intro="Status is updated when our team confirms each step." />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        {!order ? (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            {loading ? (
              <p role="status">Loading your order…</p>
            ) : (
              <>
                <p role="alert">
                  {error === "Order not found"
                    ? "We could not find this order on this device. Orders can only be opened on the phone or computer that placed them."
                    : error || "This order could not be loaded."}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void load()}>
                    Try again
                  </Button>
                  <Link to="/orders" className="inline-flex min-h-11 items-center underline">
                    Orders on this device
                  </Link>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="space-y-4 rounded-2xl bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold">Order {order.reference ?? order.id}</h2>
              <span
                data-order-status
                className={`rounded-full px-3 py-1 text-sm font-semibold ${toneClass[status!.tone]}`}
              >
                {status!.label}
              </span>
            </div>
            <p role="status">{status!.message}</p>
            {rejected && (
              <p className="text-sm">
                <strong>Reason given:</strong> {rejected.review_note}
              </p>
            )}
            <p>Total payable to Afnan: {formatNaira(order.total_kobo)}</p>
            {order.payment_method === "bank_transfer" && order.status === "pending" ? (
              <BankTransferInstructions
                order={order}
                showStatus={false}
                onUploaded={() => void load()}
              />
            ) : order.payment_method === "bank_transfer" && order.status === "expired" ? (
              // A late transfer can still be evidenced; it never reactivates the order.
              <div className="space-y-3">
                <ReceiptUpload orderId={order.id} onUploaded={() => void load()} />
                <WhatsAppReceiptButton order={order} />
              </div>
            ) : null}
            <p className="flex flex-wrap gap-x-5 gap-y-2">
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh status"}
              </Button>
              <Link to="/shop" className="inline-flex min-h-11 items-center underline">
                Continue shopping
              </Link>
            </p>
          </section>
        )}
        <aside className="h-fit rounded-2xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Summary</h2>
          {order ? <OrderSummary order={order} /> : <p className="mt-2 text-sm">—</p>}
        </aside>
      </div>
    </>
  );
}
