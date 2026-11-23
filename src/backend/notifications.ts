import { business } from "../lib/business";
import { sendStaffNotice } from "./email";
import type { CommerceEnv } from "./types";

/**
 * Administrator notifications (migration 0008).
 *
 * Every event is written in the SAME D1 batch as the state change it describes, guarded by a
 * condition that is only true when that change really happened, so an event can never describe
 * something that did not occur. Event ids are deterministic (`kind:subject`), so a retried request
 * or a concurrent duplicate adds nothing. Email is a separate, retryable outbox: a failed or
 * unconfigured provider never affects the order, its payment state or its stock reservation.
 */
export const EVENT_KINDS = [
  "order.created",
  "receipt.uploaded",
  "payment.verified",
  "payment.late_review",
  "receipt.rejected",
  "order.cancelled",
  "order.expired",
  "order.processing",
  "order.shipped",
  "order.delivered",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Fulfilment staff see fulfilment events; payment evidence and decisions stay admin-only. */
export const AUDIENCE: Record<EventKind, "admin" | "staff"> = {
  "order.created": "admin",
  "receipt.uploaded": "admin",
  "payment.verified": "staff",
  "payment.late_review": "admin",
  "receipt.rejected": "admin",
  "order.cancelled": "admin",
  "order.expired": "admin",
  "order.processing": "staff",
  "order.shipped": "staff",
  "order.delivered": "staff",
};

/** Events that also email the staff mailbox: they need someone to act. */
const EMAILED: ReadonlySet<EventKind> = new Set([
  "order.created",
  "receipt.uploaded",
  "payment.late_review",
]);
const MAX_ATTEMPTS = 6;

/**
 * Statements that record `kind` for `orderId` (subject defaults to the order) only when `guard`
 * (a SQL boolean expression, bound with `guardParams`) is true at that point in the batch.
 */
export function eventStatements(
  env: CommerceEnv,
  kind: EventKind,
  orderId: string,
  now: number,
  options: { subject?: string; guard?: string; guardParams?: unknown[] } = {},
) {
  const id = `${kind}:${options.subject ?? orderId}`;
  const guard = options.guard ?? "1";
  const params = options.guardParams ?? [];
  const statements = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO admin_events(id,kind,order_id,audience,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,
    ).bind(id, kind, orderId, AUDIENCE[kind], now, ...params),
  ];
  if (EMAILED.has(kind))
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO email_outbox(id,event_id,recipient,status,next_attempt_at,created_at,updated_at) SELECT ?,?,?,'pending',?,?,? WHERE EXISTS (SELECT 1 FROM admin_events WHERE id=?)",
      ).bind(`${id}:${business.salesEmail}`, id, business.salesEmail, now, now, now, id),
    );
  return statements;
}

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** Staff email text: reference, amount and what to do. No customer details or receipt links. */
export function staffMessage(
  kind: EventKind,
  reference: string,
  totalKobo: number,
  origin: string,
) {
  const amount = naira(totalKobo);
  const open = `Open the Afnan admin dashboard: ${origin}/admin`;
  switch (kind) {
    case "order.created":
      return {
        subject: `New order ${reference} (${amount})`,
        text: `A customer placed order ${reference} for ${amount}. It is awaiting bank transfer.\n\n${open}\n\nThe order is not paid until you confirm the exact credit in the Moniepoint account.`,
      };
    case "receipt.uploaded":
      return {
        subject: `Payment evidence to review: ${reference}`,
        text: `A customer submitted bank-transfer payment evidence for order ${reference} (total ${amount}).\n\n${open}\n\nConfirm the credit in the Moniepoint account before approving. Do not forward receipts outside the dashboard.`,
      };
    case "payment.late_review":
      return {
        subject: `Late payment to reconcile: ${reference}`,
        text: `A payment for order ${reference} (${amount}) was recorded after its deadline. The order was not reactivated and no stock was reserved. Reconcile it manually.\n\n${open}`,
      };
    default:
      return {
        subject: `Afnan order ${reference}: ${kind}`,
        text: `Order ${reference} (${amount}): ${kind}.\n\n${open}`,
      };
  }
}

/**
 * Sends due outbox emails (at most `limit`). Each row is claimed with a conditional update first,
 * so two concurrent callers never send the same message; Resend also receives the row id as its
 * Idempotency-Key. Failures back off exponentially and are abandoned after MAX_ATTEMPTS.
 */
export async function deliverOutbox(env: CommerceEnv, limit = 5) {
  const now = Math.floor(Date.now() / 1000);
  const due = (
    await env.DB.prepare(
      "SELECT x.id,x.recipient,x.attempts,e.kind,o.reference,o.id AS order_id,o.total_kobo FROM email_outbox x JOIN admin_events e ON e.id=x.event_id JOIN orders o ON o.id=e.order_id WHERE (x.status IN ('pending','failed','unconfigured') OR (x.status='sending' AND x.updated_at<?)) AND x.next_attempt_at<=? ORDER BY x.next_attempt_at LIMIT ?",
    )
      .bind(now - 300, now, limit)
      .all<{
        id: string;
        recipient: string;
        attempts: number;
        kind: EventKind;
        reference: string | null;
        order_id: string;
        total_kobo: number;
      }>()
  ).results;
  for (const row of due) {
    const claim = await env.DB.prepare(
      "UPDATE email_outbox SET status='sending',updated_at=? WHERE id=? AND attempts=? AND (status IN ('pending','failed','unconfigured') OR (status='sending' AND updated_at<?))",
    )
      .bind(now, row.id, row.attempts, now - 300)
      .run();
    if (!claim.meta.changes) continue;
    const message = staffMessage(
      row.kind,
      row.reference ?? row.order_id,
      row.total_kobo,
      env.APP_ORIGIN,
    );
    const result = await sendStaffNotice(env, row.recipient, {
      ...message,
      idempotencyKey: row.id,
    });
    const attempts = row.attempts + 1;
    const final = result.status === "sent" || result.status === "test";
    const status = final ? result.status : attempts >= MAX_ATTEMPTS ? "abandoned" : result.status;
    await env.DB.prepare(
      "UPDATE email_outbox SET status=?,attempts=?,last_error=?,next_attempt_at=?,updated_at=? WHERE id=?",
    )
      .bind(
        status,
        attempts,
        result.error ?? null,
        now + Math.min(3600, 60 * 2 ** attempts),
        now,
        row.id,
      )
      .run();
  }
}
