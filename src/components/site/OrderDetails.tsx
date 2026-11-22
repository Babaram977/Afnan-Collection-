import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/catalog";
import { business } from "@/lib/business";
import { parseSelections } from "@/lib/order-lines";
import { whatsappReceiptLink } from "@/lib/order-status";
import type { Order } from "@/lib/store";
import { ReceiptUpload } from "./ReceiptUpload";
import { SelectionList } from "./SelectionList";

/**
 * WhatsApp hand-off for the receipt. The prepared message carries only the order reference and
 * the exact amount; the customer attaches the receipt themselves in WhatsApp. Uploading on the
 * website stays available independently.
 */
export function WhatsAppReceiptButton({ order }: { order: Order }) {
  return (
    <a
      href={whatsappReceiptLink(
        business.whatsappUrl,
        order.reference ?? order.id,
        formatNaira(order.total_kobo),
      )}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground sm:w-auto"
      data-whatsapp-receipt
    >
      Send Payment Receipt via WhatsApp
    </a>
  );
}

const deadlineFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});
export function BankTransferInstructions({
  order,
  onUploaded,
}: {
  order: Order;
  onUploaded?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const deadline = deadlineFormat.format(new Date(order.expires_at * 1000));
  return (
    <div className="space-y-3">
      <p>
        <strong>Pay by:</strong>{" "}
        <time dateTime={new Date(order.expires_at * 1000).toISOString()}>{deadline}</time> (Nigeria
        time). Your items are reserved until then. Unpaid orders are cancelled automatically after
        24 hours and the items are released.
      </p>
      <dl className="grid gap-1 rounded-xl border p-4">
        <dt className="text-sm text-muted-foreground">Bank</dt>
        <dd>{business.bankName}</dd>
        <dt className="text-sm text-muted-foreground">Account name</dt>
        <dd>{business.bankAccountName}</dd>
        <dt className="text-sm text-muted-foreground">Account number</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <span className="font-semibold tracking-wider">{business.bankAccountNumber}</span>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(business.bankAccountNumber);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy account number"}
          </Button>
        </dd>
        <dt className="text-sm text-muted-foreground">Amount to transfer</dt>
        <dd className="font-semibold">{formatNaira(order.total_kobo)}</dd>
      </dl>
      <p>
        Transfer the exact order total to the account shown. After payment, upload your receipt for
        verification. Your order will be processed once payment is confirmed.
      </p>
      <p role="status">
        Awaiting transfer. Payment is confirmed only after our team verifies the credit in our
        account.
      </p>
      <ReceiptUpload orderId={order.id} {...(onUploaded ? { onUploaded } : {})} />
      <WhatsAppReceiptButton order={order} />
    </div>
  );
}

// After the order is prepared the cart is cleared, so the summary must come from the order the
// server saved (its item price snapshot, delivery fee and total), never from the empty cart.
export function OrderSummary({ order }: { order: Order }) {
  const delivery = order.delivery_kobo ?? 0;
  return (
    <>
      {(order.items ?? []).map((i) => (
        <div key={i.variant_id} className="mt-2 text-sm" data-order-item>
          <p>
            {i.qty} × {i.name} — {formatNaira(i.qty * i.price_kobo)}
          </p>
          <SelectionList selections={parseSelections(i.selections)} />
        </div>
      ))}
      <p className="mt-4">Subtotal: {formatNaira(order.total_kobo - delivery)}</p>
      <p>
        {order.fulfilment_method === "pickup" ? "Store pickup" : "Delivery"}:{" "}
        {order.fulfilment_method === "pickup"
          ? "Free"
          : order.carrier_paid_direct
            ? "Paid directly to the transport company"
            : formatNaira(delivery)}
      </p>
      <p className="mt-2 font-bold">Amount payable to Afnan: {formatNaira(order.total_kobo)}</p>
      {order.carrier_paid_direct ? (
        <p className="text-sm">
          Interstate carrier fee is not included; you pay the transport company directly.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">Saved with your order.</p>
    </>
  );
}
