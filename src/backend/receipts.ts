import type { CommerceEnv } from "./types";

/** Receipt limits (owner-approved 2026-11-15). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPTS_PER_ORDER = 5;

type ReceiptType = { contentType: string; extension: string };

/** Identify an allowed receipt by its leading bytes, never by filename or declared type. */
export function detectReceiptType(bytes: Uint8Array): ReceiptType | null {
  const ascii = (from: number, to: number) => new TextDecoder().decode(bytes.slice(from, to));
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === "PNG" && bytes[4] === 0x0d)
    return { contentType: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { contentType: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { contentType: "image/webp", extension: "webp" };
  // PDF must start with the header and contain an end-of-file marker near the end.
  if (
    bytes.length >= 16 &&
    ascii(0, 5) === "%PDF-" &&
    ascii(Math.max(0, bytes.length - 1024), bytes.length).includes("%%EOF")
  )
    return { contentType: "application/pdf", extension: "pdf" };
  return null;
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Headers for serving a private receipt to an authenticated administrator. Never cached,
 * never sniffed, sandboxed, and PDFs are always downloaded rather than rendered on our origin.
 */
export function receiptHeaders(contentType: string, reference: string, extension: string) {
  const inlineImage = contentType.startsWith("image/");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `${inlineImage ? "inline" : "attachment"}; filename="receipt-${reference.replace(/[^A-Za-z0-9-]/g, "")}.${extension}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
}

/** Customer-facing payment status derived from the order and its latest receipt. */
export function customerPaymentStatus(
  order: { status: string; payment_method: string },
  latestReceipt: { status: string } | null,
) {
  if (order.payment_method !== "bank_transfer") return null;
  if (order.status === "paid" || ["processing", "shipped", "delivered"].includes(order.status))
    return "Paid";
  if (order.status === "cancelled" || order.status === "expired") return "Cancelled";
  if (!latestReceipt) return "Awaiting Transfer";
  if (latestReceipt.status === "rejected") return "Rejected";
  return "Receipt Submitted";
}

export function hasReceiptStorage(env: CommerceEnv): env is CommerceEnv & { RECEIPTS: R2Bucket } {
  return Boolean(env.RECEIPTS);
}
