import { useCallback, useEffect, useState } from "react";
import { apiCall, type Me } from "@/lib/store";
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
  transfer_reference?: string | null;
  /** Other orders whose evidence or approval used the same reference. */
  duplicate_orders?: string | null;
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
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    apiCall<Me>("/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);
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
                  me={me}
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
  me,
  badge,
  onDone,
  onError,
}: {
  order: ReviewOrder;
  me: Me | null;
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
  // Approval problems are shown beside the form; the inputs are kept so staff can correct them.
  const [approvalError, setApprovalError] = useState<{
    field: "amount" | "reference" | "form";
    message: string;
  } | null>(null);
  const verifier = me?.name || me?.email || "";
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
              {r.transfer_reference && (
                <span data-transfer-reference>Customer reference: {r.transfer_reference}</span>
              )}
              {r.duplicate_orders && (
                <strong data-duplicate-reference className="text-destructive">
                  Same reference also used on order {r.duplicate_orders} — check before approving.
                </strong>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">No receipt submitted yet.</p>
      )}
      {!order.decision && (
        <form
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const kobo = Math.round(Number(amount) * 100);
            if (!Number.isFinite(kobo) || kobo !== order.total_kobo) {
              setApprovalError({
                field: "amount",
                message: `Enter the exact amount credited. This order's total is ${formatNaira(order.total_kobo)}.`,
              });
              return;
            }
            if (!bankReference.trim()) {
              setApprovalError({
                field: "reference",
                message: "Enter the bank's transaction reference for this credit.",
              });
              return;
            }
            setApprovalError(null);
            setBusy(true);
            try {
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
              await onDone(
                result.outcome === "paid"
                  ? `Order ${label} marked paid.`
                  : `Order ${label}: payment after the deadline recorded for manual review. The order was not reactivated and no stock was reserved.`,
              );
            } catch (err) {
              const message = (err as Error).message;
              setApprovalError({
                field: /amount/i.test(message)
                  ? "amount"
                  : /reference|staff name/i.test(message)
                    ? "reference"
                    : "form",
                message,
              });
            } finally {
              setBusy(false);
            }
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
              aria-invalid={approvalError?.field === "amount"}
              aria-describedby={
                approvalError?.field === "amount" ? `approval-error-${order.id}` : undefined
              }
            />
            {approvalError?.field === "amount" && (
              <p
                id={`approval-error-${order.id}`}
                role="alert"
                className="mt-1 text-sm text-destructive"
                data-approval-error
              >
                {approvalError.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor={`bankref-${order.id}`}>Bank transaction reference</Label>
            <Input
              id={`bankref-${order.id}`}
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              required
              maxLength={120}
              aria-invalid={approvalError?.field === "reference"}
              aria-describedby={`bankref-hint-${order.id}${approvalError?.field === "reference" ? ` approval-error-${order.id}` : ""}`}
            />
            <p id={`bankref-hint-${order.id}`} className="mt-1 text-xs text-muted-foreground">
              The transaction reference shown for this credit in Moniepoint — not a name.
            </p>
            {approvalError?.field === "reference" && (
              <p
                id={`approval-error-${order.id}`}
                role="alert"
                className="mt-1 text-sm text-destructive"
                data-approval-error
              >
                {approvalError.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 text-sm">
            <span className="text-muted-foreground">Verified by: </span>
            <span data-verifier className="break-all">
              {verifier
                ? `${verifier}${me?.name && me.email ? ` (${me.email})` : ""}`
                : "your signed-in staff account"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              — recorded automatically from your sign-in.
            </span>
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
          {approvalError?.field === "form" && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2" data-approval-error>
              {approvalError.message}
            </p>
          )}
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
