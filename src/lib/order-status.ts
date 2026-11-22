/**
 * Customer-facing order status, derived ONLY from the persisted order state and the server's
 * payment status (src/backend/receipts.ts customerPaymentStatus). It never infers a step that
 * staff have not recorded: "Shipped" appears only after staff mark the order shipped.
 */
export interface StatusView {
  label: string;
  message: string;
  tone: "waiting" | "review" | "good" | "problem" | "closed";
}

export function customerOrderStatus(order: {
  status: string;
  paymentStatus?: string | null;
  fulfilment_method?: string | null;
}): StatusView {
  const pickup = order.fulfilment_method === "pickup";
  switch (order.status) {
    case "paid":
      return {
        label: "Paid",
        message: "Thank you! We have confirmed your payment and will start preparing your order.",
        tone: "good",
      };
    case "processing":
      return {
        label: "Processing",
        message: "We are preparing your order. We will update you when it is on its way.",
        tone: "good",
      };
    case "shipped":
      return {
        label: "Shipped",
        message: pickup
          ? "Your order has been marked ready. Our team will confirm collection with you."
          : "Your order is on its way.",
        tone: "good",
      };
    case "delivered":
      return {
        label: "Delivered",
        message: "Your order is complete. Thank you for shopping with Afnan Collection.",
        tone: "closed",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        message: "This order was cancelled and its items were released.",
        tone: "closed",
      };
    case "refund_pending":
      return {
        label: "Refund in progress",
        message: "Our team is processing a refund.",
        tone: "review",
      };
    case "refunded":
      return { label: "Refunded", message: "This order was refunded.", tone: "closed" };
    case "expired":
      return order.paymentStatus === "Expired — Late Payment Under Review"
        ? {
            label: "Late Payment Under Review",
            message:
              "The payment window has closed and the items were released. Our team is reviewing your payment and will contact you.",
            tone: "review",
          }
        : {
            label: "Expired",
            message:
              "The 24-hour payment window closed and the items were released. If you already paid, upload your receipt or contact us on WhatsApp.",
            tone: "problem",
          };
    default:
      if (order.paymentStatus === "Receipt Submitted")
        return {
          label: "Receipt Submitted",
          message:
            "Thank you — we have your receipt. Our team will confirm the payment in our account; this is not yet a confirmed payment.",
          tone: "review",
        };
      if (order.paymentStatus === "Rejected")
        return {
          label: "Payment Rejected",
          message:
            "We could not match your payment evidence. Please check the details and upload a new receipt, or contact us on WhatsApp.",
          tone: "problem",
        };
      return {
        label: "Awaiting Transfer",
        message:
          "Please transfer the exact amount below before the deadline, then upload your receipt.",
        tone: "waiting",
      };
  }
}

/** Prepared WhatsApp message: order reference and amount only (no address, tokens or links). */
export function whatsappReceiptLink(whatsappUrl: string, reference: string, amount: string) {
  const text = `Hello Afnan Collection, I have placed order ${reference} for ${amount}. I would like to submit my payment receipt for verification. Thank you.`;
  return `${whatsappUrl}?text=${encodeURIComponent(text)}`;
}

/** Orders placed on this device (ids only), so a customer can reopen them after a refresh. */
const RECENT = "afnan-recent-orders-v1";
export function rememberOrder(id: string) {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT) ?? "[]") as unknown;
    const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
    localStorage.setItem(
      RECENT,
      JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 10)),
    );
  } catch {
    /* Storage may be unavailable (private mode); the server-side order list still works. */
  }
}
export function recentOrderIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT) ?? "[]") as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
