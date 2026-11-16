import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Receipt {
  id: string;
  content_type: string;
  bytes: number;
  status: "submitted" | "accepted" | "rejected" | "superseded";
  submitted_at: number;
  review_note: string | null;
}
interface ReviewOrder {
  id: string;
  reference: string | null;
  status: string;
  total_kobo: number;
  created_at: number;
  expires_at: number;
  customer_name: string;
  customer_phone: string;
  decision: "paid" | "late_review" | null;
  queue_state: QueueState;
  receipts: Receipt[];
}
type QueueState = "active_receipt" | "active_awaiting" | "expired_review" | "cancelled_review";
// Expired and active unpaid orders are always shown apart; expired ones are manual review only.
const SECTIONS: { state: QueueState; title: string; badge: string; help: string }[] = [
  {
    state: "active_receipt",
    title: "Active — receipt submitted",
    badge: "Active · receipt to review",
    help: "Within the 24-hour window. Check the Moniepoint account, then approve or reject.",
  },
  {
    state: "expired_review",
    title: "Expired — manual review only",
    badge: "Expired · manual review",
    help: "The payment window closed and the items were released. A decision records the late payment for review; it never reactivates the order or reserves stock.",
  },
  {
    state: "cancelled_review",
    title: "Cancelled — evidence received",
    badge: "Cancelled · evidence received",
    help: "The customer cancelled after sending evidence. Resolve manually (for example a refund).",
  },
  {
    state: "active_awaiting",
    title: "Active — awaiting transfer",
    badge: "Active · awaiting transfer",
    help: "Within the 24-hour window; no receipt yet. You may still confirm a credit you can see.",
  },
];
const when = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Admin-only review of bank-transfer payment evidence. */
export function PaymentReview() {
  const [orders, setOrders] = useState<ReviewOrder[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      setOrders(await apiCall<ReviewOrder[]>("/admin/payment-review"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Bank-transfer payments</h2>
      <p className="text-sm text-muted-foreground">
        Approve only after you have seen the exact credit in the Moniepoint account. A receipt is
        evidence, not proof of payment.
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!orders.length && <p>No bank-transfer payments are waiting for review.</p>}
      {SECTIONS.map((section) => {
        const group = orders.filter((o) => o.queue_state === section.state);
        if (!group.length) return null;
        return (
          <section
            key={section.state}
            aria-labelledby={`queue-${section.state}`}
            className="space-y-3"
          >
            <h3 id={`queue-${section.state}`} className="text-base font-medium">
              {section.title} ({group.length})
            </h3>
            <p className="text-sm text-muted-foreground">{section.help}</p>
            <ul className="space-y-4">
              {group.map((o) => (
                <ReviewCard
                  key={o.id}
                  order={o}
                  badge={section.badge}
                  onDone={async (message) => {
                    setNotice(message);
                    setError("");
                    await load();
                  }}
                  onError={setError}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

function ReviewCard({
  order,
  badge,
  onDone,
  onError,
}: {
  order: ReviewOrder;
  badge: string;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const label = order.reference ?? order.id;
  const submitted = order.receipts.filter((r) => r.status === "submitted");
  const [receiptId, setReceiptId] = useState(submitted[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Server state decides; the clock check only covers a page left open past the deadline.
  const late =
    order.queue_state !== "active_receipt" && order.queue_state !== "active_awaiting"
      ? true
      : order.expires_at * 1000 <= Date.now();
  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      await onDone(await action());
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-lg font-semibold">Order {label}</h4>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            late ? "bg-destructive/10 text-destructive" : "bg-secondary"
          }`}
        >
          {badge}
        </span>
      </div>
      <p className="text-sm">
        {order.customer_name} · {order.customer_phone} · {formatNaira(order.total_kobo)}
      </p>
      <p className="text-sm">
        {late ? (
          <strong>Payment deadline passed {when(order.expires_at)} — manual review only.</strong>
        ) : (
          <>Pay by {when(order.expires_at)}</>
        )}
        {order.decision === "late_review" && " Late payment recorded for review."}
      </p>
      {order.receipts.length ? (
        <ul className="space-y-2">
          {order.receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`/api/admin/receipts/${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View receipt ({r.content_type === "application/pdf" ? "PDF" : "image"},{" "}
                {Math.ceil(r.bytes / 1024)} KB)
              </a>
              <span>
                {r.status} · {when(r.submitted_at)}
              </span>
              {r.review_note && <span>Reason: {r.review_note}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">No receipt submitted yet.</p>
      )}
      {!order.decision && (
        <form
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await apiCall<{ outcome: string }>(
                `/admin/orders/${order.id}/bank-transfer-approval`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    amountKobo: Math.round(Number(amount) * 100),
                    bankReference,
                    creditConfirmed: confirmed,
                    ...(receiptId ? { receiptId } : {}),
                  }),
                },
              );
              return result.outcome === "paid"
                ? `Order ${label} marked paid.`
                : `Order ${label}: payment after the deadline recorded for manual review. The order was not reactivated and no stock was reserved.`;
            });
          }}
        >
          <h5 className="font-semibold sm:col-span-2">
            {late ? "Record a late payment for manual review" : "Confirm payment"}
          </h5>
          <div>
            <Label htmlFor={`amount-${order.id}`}>Amount credited (₦)</Label>
            <Input
              id={`amount-${order.id}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`bankref-${order.id}`}>Bank transaction reference</Label>
            <Input
              id={`bankref-${order.id}`}
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          {submitted.length > 1 && (
            <div className="sm:col-span-2">
              <Label htmlFor={`receipt-${order.id}`}>Receipt reviewed</Label>
              <select
                id={`receipt-${order.id}`}
                className="block w-full rounded-md border p-2"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
              >
                {submitted.map((r) => (
                  <option key={r.id} value={r.id}>
                    {when(r.submitted_at)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            I have confirmed this exact amount was credited to the Moniepoint account.
          </label>
          <Button type="submit" disabled={busy || !confirmed} className="sm:col-span-2">
            {late ? "Record late payment for review" : "Approve payment"}
          </Button>
        </form>
      )}
      {submitted.map((r) => (
        <form
          key={r.id}
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await apiCall(`/admin/receipts/${r.id}/reject`, {
                method: "POST",
                body: JSON.stringify({ reason }),
              });
              setReason("");
              return `Receipt for ${label} rejected. The customer can submit another.`;
            });
          }}
        >
          <div className="grow">
            <Label htmlFor={`reject-${r.id}`}>Reason for rejecting this receipt</Label>
            <Input
              id={`reject-${r.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={500}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            Reject receipt
          </Button>
        </form>
      ))}
    </li>
  );
}
