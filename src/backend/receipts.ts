import type { CommerceEnv } from "./types";

/** Receipt limits (owner-approved 2026-11-15). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPTS_PER_ORDER = 5;

type ReceiptType = { contentType: string; extension: string };
export type ReceiptInspection = { ok: true; type: ReceiptType } | { ok: false; message: string };

const UNSUPPORTED = "Upload a JPEG, PNG, WebP or PDF receipt.";
const DAMAGED = "This file looks damaged or incomplete. Upload the original receipt again.";
// PDF features a payment receipt never needs and that can carry active content.
const PDF_ACTIVE_CONTENT =
  /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|XFA|SubmitForm|ImportData|GoToE)(?![A-Za-z])/;

/**
 * Check an uploaded receipt by its actual contents, never by filename or declared type.
 * Limits: structure checks catch spoofed, truncated and malformed files and refuse PDFs with
 * active content or encryption. Names hidden inside compressed PDF streams cannot be seen here,
 * so the second line of defence is that receipts are never rendered on our origin: PDFs are
 * always served as downloads, every receipt response is sandboxed and nosniff.
 */
export function inspectReceipt(bytes: Uint8Array): ReceiptInspection {
  // One character per byte (ISO-8859-1), without relying on TextDecoder label support.
  const latin1 = (from: number, to: number) => {
    const part = bytes.subarray(Math.max(0, from), Math.max(0, to));
    let out = "";
    for (let i = 0; i < part.length; i += 8192)
      out += String.fromCharCode(...part.subarray(i, i + 8192));
    return out;
  };
  const u32le = (at: number) =>
    (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

  // PNG: signature, IHDR as the first chunk, IEND as the final chunk.
  if (bytes.length >= 8 && latin1(0, 8) === "\x89PNG\r\n\x1a\n") {
    if (
      bytes.length < 45 ||
      latin1(12, 16) !== "IHDR" ||
      !latin1(bytes.length - 12, bytes.length).includes("IEND")
    )
      return { ok: false, message: DAMAGED };
    return { ok: true, type: { contentType: "image/png", extension: "png" } };
  }
  // JPEG: SOI followed by a real segment marker (APPn, DQT, SOF, DHT or COM).
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const m = bytes[3]!;
    if (
      bytes.length < 128 ||
      !(
        (m >= 0xe0 && m <= 0xef) ||
        m === 0xdb ||
        m === 0xc4 ||
        m === 0xfe ||
        (m >= 0xc0 && m <= 0xc3)
      )
    )
      return { ok: false, message: DAMAGED };
    return { ok: true, type: { contentType: "image/jpeg", extension: "jpg" } };
  }
  // WebP: RIFF container whose declared size fits the file, with a VP8/VP8L/VP8X chunk.
  if (bytes.length >= 12 && latin1(0, 4) === "RIFF" && latin1(8, 12) === "WEBP") {
    const declared = u32le(4);
    if (
      bytes.length < 30 ||
      declared < 4 ||
      declared > bytes.length - 8 ||
      !["VP8 ", "VP8L", "VP8X"].includes(latin1(12, 16))
    )
      return { ok: false, message: DAMAGED };
    return { ok: true, type: { contentType: "image/webp", extension: "webp" } };
  }
  // PDF: header, end-of-file marker, no encryption, no active content.
  if (bytes.length >= 5 && latin1(0, 5) === "%PDF-") {
    if (bytes.length < 64 || !latin1(bytes.length - 1024, bytes.length).includes("%%EOF"))
      return { ok: false, message: DAMAGED };
    const text = latin1(0, bytes.length);
    if (/\/Encrypt(?![A-Za-z])/.test(text))
      return {
        ok: false,
        message:
          "This PDF is password-protected. Upload an unprotected PDF or a screenshot of the receipt.",
      };
    if (PDF_ACTIVE_CONTENT.test(text))
      return {
        ok: false,
        message:
          "This PDF contains scripts, attachments or forms and can't be accepted. Upload a plain PDF or a screenshot of the receipt.",
      };
    return { ok: true, type: { contentType: "application/pdf", extension: "pdf" } };
  }
  return { ok: false, message: UNSUPPORTED };
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
export const CUSTOMER_PAYMENT_STATUSES = [
  "Awaiting Transfer",
  "Receipt Submitted",
  "Rejected",
  "Paid",
  "Expired",
  "Expired — Late Payment Under Review",
  "Cancelled",
] as const;
export type CustomerPaymentStatus = (typeof CUSTOMER_PAYMENT_STATUSES)[number];
/**
 * Expired is distinct from Cancelled: the payment window closed without a confirmed payment.
 * Evidence or a late-payment decision on an expired order shows it is under manual review;
 * the order is never reactivated by either.
 */
export function customerPaymentStatus(
  order: { status: string; payment_method: string },
  latestReceipt: { status: string } | null,
  decision: string | null = null,
): CustomerPaymentStatus | null {
  if (order.payment_method !== "bank_transfer") return null;
  if (order.status === "paid" || ["processing", "shipped", "delivered"].includes(order.status))
    return "Paid";
  if (order.status === "expired")
    return decision === "late_review" || latestReceipt?.status === "submitted"
      ? "Expired — Late Payment Under Review"
      : "Expired";
  if (order.status === "cancelled") return "Cancelled";
  if (!latestReceipt) return "Awaiting Transfer";
  if (latestReceipt.status === "rejected") return "Rejected";
  return "Receipt Submitted";
}

export function hasReceiptStorage(env: CommerceEnv): env is CommerceEnv & { RECEIPTS: R2Bucket } {
  return Boolean(env.RECEIPTS);
}
