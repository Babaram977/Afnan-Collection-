import { business } from "../lib/business";
import { z } from "zod";
import type { Product, CategorySlug, AgeGroup } from "../lib/catalog";
import { authFor } from "./auth";
import { adminProof, adminSecurity, SecurityError, securityLimit, digest } from "./admin-security";
import { passwordAdmin, type CommerceEnv } from "./types";
import {
  orderInput,
  productInput,
  variantInput,
  stockInput,
  zoneInput,
  bannerInput,
  policyInput,
  addressInput,
  businessSettingsInput,
  bankTransferApprovalInput,
  receiptRejectionInput,
} from "./validation";
import {
  RECEIPT_MAX_BYTES,
  RECEIPTS_PER_ORDER,
  customerPaymentStatus,
  inspectReceipt,
  hasReceiptStorage,
  receiptHeaders,
  sha256Hex,
} from "./receipts";
import { sendPaymentReviewNotice } from "./email";
import {
  initialize,
  paymentEnabled,
  validSignature,
  verify,
  requestRefund,
  verifyRefund,
} from "./payments";

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = () => crypto.randomUUID();
const hash = async (v: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
async function bounded(request: Request, max = 65536) {
  if (Number(request.headers.get("Content-Length")) > max) fail(413, "Request too large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      fail(413, "Request too large");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
}
async function body(request: Request) {
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    fail(415, "JSON required");
  try {
    return JSON.parse(new TextDecoder().decode(await bounded(request)));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    return fail(400, "Invalid JSON");
  }
}
interface Actor {
  owner: string;
  userId: string | null;
  email: string | null;
  role: string | null;
}
async function actor(request: Request, env: CommerceEnv): Promise<Actor> {
  const session = await authFor(env).api.getSession({ headers: request.headers });
  if (session) {
    const staff = await env.DB.prepare("SELECT role FROM staff WHERE user_id=?")
      .bind(session.user.id)
      .first<{ role: string }>();
    return {
      owner: session.user.id,
      userId: session.user.id,
      email: session.user.email,
      role:
        staff &&
        (passwordAdmin(env)
          ? session.session.authMethod === "password" &&
            (await passwordAdminActive(env, session.user.id))
          : await adminProof(request, env, session))
          ? staff.role
          : null,
    };
  }
  const token = request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)afnan_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
  return {
    owner: token ? `guest:${await hash(token)}` : "",
    userId: null,
    email: null,
    role: null,
  };
}
// Password mode: the staff row (checked on every request by actor()) plus a set password and a
// security state that is not disabled. Removing the staff row revokes access on the next request.
async function passwordAdminActive(env: CommerceEnv, userId: string) {
  return Boolean(
    await env.DB.prepare(
      `SELECT 1 FROM account a WHERE a.user_id=? AND a.provider_id='credential' AND a.password IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM admin_security s WHERE s.user_id=a.user_id AND s.state='disabled')`,
    )
      .bind(userId)
      .first(),
  );
}
// One-time password setup for an operator-provisioned administrator. The token (32 random bytes,
// shown once to the operator) is stored only as a SHA-256 digest in `verification`, expires after
// 30 minutes and is consumed on use. The password is hashed by Better Auth (scrypt) and never logged.
async function adminPasswordSetup(env: CommerceEnv, input: unknown) {
  const { token, password } = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      password: z.string().min(12).max(128),
    })
    .parse(input);
  const identifier = `admin-setup:${await digest(token)}`;
  const row = await env.DB.prepare(
    `SELECT v.id,v.value AS userId FROM verification v JOIN staff r ON r.user_id=v.value
    WHERE v.identifier=? AND v.expires_at>?`,
  )
    .bind(identifier, Date.now())
    .first<{ id: string; userId: string }>();
  if (!row) fail(400, "This setup link is invalid or has expired");
  const consumed = await env.DB.prepare("DELETE FROM verification WHERE id=? RETURNING id")
    .bind(row.id)
    .first();
  if (!consumed) fail(400, "This setup link is invalid or has expired");
  const hashed = await (await authFor(env).$context).password.hash(password);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM account WHERE user_id=? AND provider_id='credential'").bind(
      row.userId,
    ),
    env.DB.prepare(
      "INSERT INTO account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES(?,?,'credential',?,?,?,?)",
    ).bind(crypto.randomUUID(), row.userId, row.userId, hashed, now, now),
    env.DB.prepare("UPDATE user SET email_verified=1,updated_at=? WHERE id=?").bind(
      now,
      row.userId,
    ),
    env.DB.prepare("DELETE FROM session WHERE user_id=?").bind(row.userId),
    env.DB.prepare(
      "INSERT INTO audit(actor,action,entity_id) VALUES(?,'admin.password.set',?)",
    ).bind(row.userId, row.userId),
  ]);
  return json({ ok: true });
}
function requireRole(a: Actor, roles = ["admin"]) {
  if (!a.userId) fail(401, "Sign in required");
  if (!a.role || !roles.includes(a.role)) fail(403, "Staff access required");
}
async function audit(
  env: CommerceEnv,
  a: Actor,
  action: string,
  id: string,
  detail: Record<string, unknown> = {},
) {
  return env.DB.prepare("INSERT INTO audit(actor,action,entity_id,detail) VALUES(?,?,?,?)").bind(
    a.userId ?? a.owner,
    action,
    id,
    JSON.stringify(detail),
  );
}
// Owner-approved payment windows (seconds). Bank transfer: 24 hours. Paystack (disabled): 30 minutes.
export const PAYMENT_WINDOW = { bank_transfer: 24 * 60 * 60, paystack: 30 * 60 } as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);
// Africa/Lagos calendar day as YYYYMMDD, for the customer-facing order reference.
const lagosDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const referenceDay = () => lagosDay.format(new Date()).replaceAll("-", "");
// The order as saved, with its item price snapshot, for the customer's confirmation.
async function orderWithItems(env: CommerceEnv, order: OrderRow) {
  const items = await env.DB.prepare(
    "SELECT variant_id,name,sku,price_kobo,qty FROM order_items WHERE order_id=?",
  )
    .bind(order.id)
    .all();
  return { ...order, items: items.results };
}
const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
// Customer upload of bank-transfer payment evidence. Ownership is already enforced by ownOrder()
// (signed-in owner or the guest-order cookie), and the Origin check guards against CSRF.
async function submitReceipt(request: Request, env: CommerceEnv, a: Actor, order: OrderRow) {
  if (order.payment_method !== "bank_transfer")
    fail(409, "Receipts are only for bank-transfer orders");
  // Expired orders still accept evidence so a late transfer can be reviewed manually;
  // submitting never extends the deadline, reactivates the order or reserves stock.
  if (order.status !== "pending" && order.status !== "expired")
    fail(409, "This order is not awaiting payment evidence");
  if (!hasReceiptStorage(env)) return fail(503, "Receipt upload is not available yet");
  await limited(request, env, "receipt", 10);
  const bytes = await bounded(request, RECEIPT_MAX_BYTES);
  if (!bytes.length) fail(400, "Choose a receipt file to upload");
  const inspection = inspectReceipt(bytes);
  if (!inspection.ok) return fail(415, inspection.message);
  const type = inspection.type;
  const sha256 = await sha256Hex(bytes);
  const existing = () =>
    env.DB.prepare("SELECT id,status FROM payment_receipts WHERE order_id=? AND sha256=?")
      .bind(order.id, sha256)
      .first<{ id: string; status: string }>();
  const prior = await existing();
  if (prior) return json({ id: prior.id, status: prior.status, duplicate: true });
  const id = uuid();
  const notificationId = uuid();
  const key = `receipts/${order.id}/${uuid()}.${type.extension}`;
  const now = nowSeconds();
  await env.RECEIPTS.put(key, bytes, { httpMetadata: { contentType: type.contentType } });
  let saved = 0;
  try {
    const results = await env.DB.batch([
      // The per-order limit is checked inside the insert, so concurrent uploads cannot exceed it.
      env.DB.prepare(
        "INSERT INTO payment_receipts(id,order_id,object_key,content_type,bytes,sha256,submitted_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM payment_receipts WHERE order_id=?)<?",
      ).bind(
        id,
        order.id,
        key,
        type.contentType,
        bytes.length,
        sha256,
        now,
        order.id,
        RECEIPTS_PER_ORDER,
      ),
      env.DB.prepare(
        "INSERT INTO notifications(id,kind,order_id,recipient,status,created_at,updated_at) SELECT ?,'payment_review',?,?,'pending',?,? WHERE EXISTS (SELECT 1 FROM payment_receipts WHERE id=?)",
      ).bind(notificationId, order.id, business.salesEmail, now, now, id),
      env.DB.prepare(
        "INSERT INTO audit(actor,action,entity_id,detail) SELECT ?,'payment.receipt.submitted',?,? WHERE EXISTS (SELECT 1 FROM payment_receipts WHERE id=?)",
      ).bind(
        a.userId ?? a.owner,
        order.id,
        JSON.stringify({
          receiptId: id,
          contentType: type.contentType,
          bytes: bytes.length,
          sha256,
          afterDeadline: order.status === "expired",
        }),
        id,
      ),
    ]);
    saved = results[0]?.meta.changes ?? 0;
  } catch {
    saved = 0;
  }
  if (!saved) {
    await env.RECEIPTS.delete(key);
    const raced = await existing();
    if (raced) return json({ id: raced.id, status: raced.status, duplicate: true });
    return fail(429, "Receipt limit reached for this order. Contact us on WhatsApp for help.");
  }
  const notice = await sendPaymentReviewNotice(env, business.salesEmail, {
    reference: order.reference ?? order.id,
    totalNaira: naira(order.total_kobo),
  });
  await env.DB.prepare(
    "UPDATE notifications SET status=?,attempts=attempts+1,last_error=?,updated_at=? WHERE id=?",
  )
    .bind(notice.status, notice.error ?? null, nowSeconds(), notificationId)
    .run();
  return json({ id, status: "submitted" }, 201);
}
async function orderReceipts(env: CommerceEnv, orderId: string) {
  return (
    await env.DB.prepare(
      "SELECT id,content_type,bytes,status,submitted_at,review_note FROM payment_receipts WHERE order_id=? ORDER BY submitted_at DESC, rowid DESC",
    )
      .bind(orderId)
      .all<{ id: string; status: string }>()
  ).results;
}
async function limited(request: Request, env: CommerceEnv, route: string, max: number) {
  const window = Math.floor(Date.now() / 60000);
  const key = await hash(
    `${request.headers.get("CF-Connecting-IP") ?? "local"}:${route}:${window}`,
  );
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, (window + 2) * 60)
    .first<{ count: number }>();
  if ((row?.count ?? 999) > max) fail(429, "Too many requests. Try again later.");
}
async function expire(env: CommerceEnv) {
  // One timestamp for both statements, so every expired order is audited exactly once.
  // The batch is a single transaction; restore_stock releases each reservation once.
  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO audit(actor,action,entity_id,detail) SELECT 'order-service','order.expired',id,json_object('paymentMethod',payment_method,'expiresAt',expires_at,'stockReleased',1) FROM orders WHERE status='pending' AND expires_at<=?",
    ).bind(now),
    env.DB.prepare(
      "UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<=?",
    ).bind(now),
    env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<unixepoch()"),
  ]);
}
async function catalog(env: CommerceEnv, all = false): Promise<Product[]> {
  await expire(env);
  const products = await env.DB.prepare(
    `SELECT p.*,c.label AS category_label FROM products p JOIN categories c ON c.slug=p.category ${all ? "WHERE p.deleted_at IS NULL" : "WHERE p.status='active' AND p.deleted_at IS NULL"} ORDER BY updated_at DESC LIMIT 500`,
  ).all<Record<string, unknown>>();
  const variants = await env.DB.prepare(
    `SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id ${all ? "WHERE p.deleted_at IS NULL" : "WHERE p.status='active' AND p.deleted_at IS NULL"} LIMIT 5000`,
  ).all<Record<string, unknown>>();
  return products.results.map((p) => ({
    id: String(p["id"]),
    slug: String(p["slug"]),
    name: String(p["name"]),
    description: String(p["description"]),
    category: p["category"] as CategorySlug,
    categoryLabel: String(p["category_label"]),
    ageGroups: JSON.parse(String(p["age_groups"])) as AgeGroup[],
    images: JSON.parse(String(p["images"])),
    featured: Boolean(p["featured"]),
    seasonal: Boolean(p["seasonal"]),
    ageGuidance: String(p["age_guidance"]),
    safetyNotes: String(p["safety_notes"]),
    ...(all ? { status: p["status"] } : {}),
    variants: variants.results
      .filter((v) => v["product_id"] === p["id"])
      .map((v) => ({
        id: String(v["id"]),
        sku: String(v["sku"]),
        size: String(v["size"]),
        color: String(v["color"]),
        priceKobo: Number(v["sale_price_kobo"] ?? v["price_kobo"]),
        regularPriceKobo: Number(v["price_kobo"]),
        salePriceKobo: v["sale_price_kobo"] == null ? null : Number(v["sale_price_kobo"]),
        stock: Number(v["stock"]),
        lowStock: Number(v["low_stock"]),
      })),
  }));
}
interface OrderRow {
  id: string;
  owner: string;
  user_id: string | null;
  email: string;
  status: string;
  total_kobo: number;
  request_hash: string;
  expires_at: number;
  payment_method: "paystack" | "bank_transfer";
  reference: string | null;
  delivery_kobo: number;
  customer: string;
  address: string;
}
async function ownOrder(env: CommerceEnv, a: Actor, id: string, staff = false) {
  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE id=? ${staff ? "" : "AND owner=?"}`,
  )
    .bind(...(staff ? [id] : [id, a.owner]))
    .first<OrderRow>();
  if (!order) return fail(404, "Order not found");
  return order;
}
async function createOrder(request: Request, env: CommerceEnv, a: Actor) {
  if (env.CHECKOUT_ENABLED !== "true") fail(503, "Ordering is not enabled");
  if (!a.owner) fail(400, "Refresh the checkout to start a session");
  const input = orderInput.parse(await body(request));
  if (a.email && a.email !== input.customer.email.toLowerCase())
    fail(400, "Use your account email");
  const requestHash = await hash(
    JSON.stringify({
      ...input,
      lines: [...input.lines].sort((a, b) => a.variantId.localeCompare(b.variantId)),
    }),
  );
  const existing = await env.DB.prepare("SELECT * FROM orders WHERE owner=? AND idempotency_key=?")
    .bind(a.owner, input.idempotencyKey)
    .first<OrderRow>();
  if (existing) {
    if (existing.request_hash !== requestHash)
      fail(409, "Idempotency key already used for another request");
    return json(await orderWithItems(env, existing));
  }
  const zone = await env.DB.prepare(
    "SELECT * FROM zones WHERE id=? AND active=1 AND lower(state)=lower(?)",
  )
    .bind(input.zoneId, input.address.state)
    .first<{ fee_kobo: number }>();
  if (!zone) fail(400, "Delivery is unavailable for this address");
  const id = uuid();
  // Paystack is used only when it is explicitly enabled; otherwise orders are manual bank transfers.
  const paymentMethod = paymentEnabled(env) ? "paystack" : "bank_transfer";
  const expiresAt = nowSeconds() + PAYMENT_WINDOW[paymentMethod];
  const day = referenceDay();
  // The counter increment and the order insert share one transaction: a failed checkout
  // (stock or price changed) rolls back and does not consume a reference number.
  const statements = [
    env.DB.prepare(
      "INSERT INTO order_reference_counters(day,last) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET last=last+1",
    ).bind(day),
    env.DB.prepare(
      "INSERT INTO orders(id,owner,user_id,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,payment_method,expires_at,reference) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,(SELECT 'AC-'||day||'-'||printf('%04d',last) FROM order_reference_counters WHERE day=?))",
    ).bind(
      id,
      a.owner,
      a.userId,
      input.idempotencyKey,
      requestHash,
      input.customer.email.toLowerCase(),
      JSON.stringify(input.customer),
      JSON.stringify(input.address),
      input.zoneId,
      zone.fee_kobo,
      paymentMethod,
      expiresAt,
      day,
    ),
  ];
  for (const line of input.lines) {
    const variant = await env.DB.prepare(
      "SELECT v.*,p.name FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND p.status='active' AND p.deleted_at IS NULL",
    )
      .bind(line.variantId)
      .first<{
        id: string;
        name: string;
        sku: string;
        price_kobo: number;
        sale_price_kobo: number | null;
      }>();
    if (!variant) fail(409, "An item is no longer available");
    statements.push(
      env.DB.prepare(
        "INSERT INTO order_items(order_id,variant_id,name,sku,price_kobo,qty) VALUES(?,?,?,?,?,?)",
      ).bind(
        id,
        variant.id,
        variant.name,
        variant.sku,
        variant.sale_price_kobo ?? variant.price_kobo,
        line.qty,
      ),
    );
  }
  statements.push(
    env.DB.prepare(
      "UPDATE orders SET total_kobo=delivery_kobo+(SELECT SUM(price_kobo*qty) FROM order_items WHERE order_id=?) WHERE id=?",
    ).bind(id, id),
  );
  statements.push(
    await audit(env, a, "order.created", id, {
      paymentMethod,
      expiresAt,
      stockReserved: input.lines.map(({ variantId, qty }) => ({ variantId, qty })),
    }),
  );
  try {
    await env.DB.batch(statements);
  } catch {
    const replay = await env.DB.prepare("SELECT * FROM orders WHERE owner=? AND idempotency_key=?")
      .bind(a.owner, input.idempotencyKey)
      .first<OrderRow>();
    if (replay && replay.request_hash === requestHash)
      return json(await orderWithItems(env, replay));
    return fail(409, "Stock changed or this request conflicts. Refresh your cart.");
  }
  return json(await orderWithItems(env, await ownOrder(env, a, id)), 201);
}
async function reconcile(env: CommerceEnv, reference: string) {
  await expire(env);
  const payment = await env.DB.prepare("SELECT * FROM payments WHERE reference=?")
    .bind(reference)
    .first<{ amount_kobo: number; order_id: string; status: string }>();
  if (!payment) fail(404, "Payment not found");
  const verified = await verify(env, reference);
  if (
    verified.reference !== reference ||
    verified.currency !== "NGN" ||
    verified.amount !== payment.amount_kobo ||
    verified.status !== "success"
  )
    fail(409, "Payment could not be verified");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE payments SET status=CASE WHEN (SELECT status FROM orders WHERE id=order_id) IN ('cancelled','expired') THEN 'review' ELSE 'paid' END,provider_id=?,updated_at=unixepoch() WHERE reference=? AND status NOT IN ('refunded','refund_pending')",
    ).bind(verified.id, reference),
    env.DB.prepare(
      "UPDATE orders SET status='paid' WHERE id=? AND status='pending' AND expires_at>unixepoch()",
    ).bind(payment.order_id),
    env.DB.prepare(
      "INSERT OR IGNORE INTO payment_events(id,reference,type) VALUES(?,?,'charge.success')",
    ).bind(`charge:${verified.id}`, reference),
  ]);
  return { reference, verified: true };
}
async function routes(request: Request, env: CommerceEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (!env.DB) fail(503, "Database is not configured");
  if (path === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({
      status: "ok",
      checkoutEnabled: env.CHECKOUT_ENABLED === "true",
      paymentsEnabled: Boolean(paymentEnabled(env)),
    });
  }
  if (method !== "GET" && method !== "HEAD" && path !== "/api/payments/webhook") {
    if (request.headers.get("Origin") !== env.APP_ORIGIN) fail(403, "Invalid request origin");
    if (request.headers.get("Sec-Fetch-Site") === "cross-site")
      fail(403, "Cross-site request rejected");
  }
  if (path.startsWith("/api/auth/")) {
    const allowed = [
      "/api/auth/email-otp/send-verification-otp",
      "/api/auth/sign-in/email-otp",
      "/api/auth/sign-out",
      "/api/auth/get-session",
      ...(passwordAdmin(env) ? ["/api/auth/sign-in/email"] : []),
    ];
    if (!allowed.includes(path)) fail(404, "Not found");
    await limited(request, env, "auth", 15);
    if (method === "POST") {
      const data = await bounded(request);
      let otpEmail: string | undefined;
      if (path === "/api/auth/sign-in/email") {
        const parsed = z
          .object({ email: z.string().email().max(254), password: z.string().min(1).max(128) })
          .passthrough()
          .parse(JSON.parse(new TextDecoder().decode(data)));
        const email = parsed.email.trim().toLowerCase();
        await securityLimit(env, `password:${email}`, 5);
        await securityLimit(env, `password-hour:${email}`, 20, 3600);
      }
      if (path === "/api/auth/email-otp/send-verification-otp") {
        const parsed = z
          .object({ email: z.string().email().max(254), type: z.literal("sign-in") })
          .parse(JSON.parse(new TextDecoder().decode(data)));
        if (typeof parsed.email === "string") {
          const email = parsed.email.trim().toLowerCase();
          otpEmail = email;
          await securityLimit(env, `email:${email}`, 5);
          await securityLimit(env, `email-hour:${email}`, 20, 3600);
          const cooldown = await env.DB.prepare(
            "INSERT INTO auth_cooldowns(key,expires_at) VALUES(?,unixepoch()+30) ON CONFLICT(key) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<=unixepoch() RETURNING key",
          )
            .bind(await digest(`email:${email}`))
            .first();
          if (!cooldown) fail(429, "Please wait before requesting another code");
        }
      }
      const response = await authFor(env).handler(
        new Request(request.url, { method, headers: request.headers, body: data }),
      );
      if (otpEmail !== undefined) {
        // Operator-only diagnostic. With sign-up disabled, Better Auth acknowledges a code request
        // for an address with no account without generating or sending a code (non-enumerating).
        // The client response stays identical; the log carries no address or code.
        const known = await env.DB.prepare("SELECT 1 FROM user WHERE lower(email)=?")
          .bind(otpEmail)
          .first();
        if (!known) console.log(JSON.stringify({ event: "auth.otp.no_account" }));
      }
      if (!response.ok && path === "/api/auth/email-otp/send-verification-otp") {
        // Do not expose account existence via provider failures. Delivery monitoring is separate.
        console.error(JSON.stringify({ event: "auth.email.unavailable" }));
        return json({ success: true });
      }
      if (!response.ok && path === "/api/auth/sign-in/email") {
        await env.DB.prepare(
          "INSERT INTO audit(actor,action,entity_id) VALUES('anonymous','auth.password.failed','password-sign-in')",
        ).run();
        // Same message for unknown email and wrong password.
        return json(
          { error: "Email or password is incorrect" },
          response.status === 429 ? 429 : 401,
        );
      }
      if (!response.ok && path === "/api/auth/sign-in/email-otp")
        return json(
          { error: "Authentication could not be completed" },
          response.status === 429 ? 429 : 400,
        );
      return response;
    }
    return authFor(env).handler(request);
  }
  if (path === "/api/admin-setup" && method === "POST" && passwordAdmin(env)) {
    await limited(request, env, "admin-setup", 10);
    return adminPasswordSetup(env, JSON.parse(new TextDecoder().decode(await bounded(request))));
  }
  if (path.startsWith("/api/admin-security/")) {
    // Legacy MFA-management paths must not become an alternate password-mode entry point.
    if (passwordAdmin(env)) requireRole(await actor(request, env));
    await limited(request, env, "admin-security", 30);
    return adminSecurity(request, env, method === "POST" ? await body(request) : {});
  }
  await limited(request, env, path.startsWith("/api/admin") ? "admin" : "api", 120);
  if (path === "/api/products" && method === "GET") return json(await catalog(env));
  if (path.startsWith("/api/products/") && method === "GET") {
    const p = (await catalog(env)).find((p) => p.slug === decodeURIComponent(path.slice(14)));
    return p ? json(p) : fail(404, "Product not found");
  }
  if (path === "/api/business" && method === "GET") return json(await businessConfig(env));
  if (path === "/api/categories" && method === "GET")
    return json((await env.DB.prepare("SELECT * FROM categories ORDER BY label").all()).results);
  if (path === "/api/store" && method === "GET")
    return json({
      banners: (await env.DB.prepare("SELECT * FROM banners WHERE active=1").all()).results,
      content: (await env.DB.prepare("SELECT * FROM content").all()).results,
    });
  if (path === "/api/zones" && method === "GET")
    return json((await env.DB.prepare("SELECT * FROM zones WHERE active=1").all()).results);
  if (path === "/api/payments/webhook" && method === "POST") {
    if (!paymentEnabled(env)) fail(503, "Payments are disabled");
    const raw = new TextDecoder().decode(await bounded(request));
    if (!validSignature(raw, request.headers.get("x-paystack-signature") ?? "", env))
      fail(401, "Invalid signature");
    const event = z
      .object({
        event: z.string(),
        data: z.object({ reference: z.string().max(100).optional() }).passthrough(),
      })
      .parse(JSON.parse(raw));
    if (event.event === "charge.success" && event.data.reference)
      await reconcile(env, event.data.reference);
    // Refund callbacks are reconciled by an explicit provider verification workflow,
    // never accepted as proof from a browser or used to restore inventory automatically.
    return json({ received: true });
  }
  const a = await actor(request, env);
  if (path === "/api/me" && method === "GET")
    return json({
      userId: a.userId,
      email: a.email,
      role: a.role,
      adminAuth: passwordAdmin(env) ? "password" : "webauthn",
    });
  if (path === "/api/cart" && method === "GET")
    return json(
      a.owner
        ? JSON.parse(
            (
              await env.DB.prepare("SELECT lines FROM carts WHERE owner=?")
                .bind(a.owner)
                .first<{ lines: string }>()
            )?.lines ?? "[]",
          )
        : [],
    );
  if (path === "/api/cart" && method === "PUT") {
    if (!a.owner) fail(400, "Session required");
    const lines = z
      .array(
        z.object({
          variantId: z.string().uuid(),
          qty: z.number().int().min(1).max(99),
          // Customer's option choices/note for the line (plain text, shown back to the customer).
          note: z.string().trim().max(200).optional(),
        }),
      )
      .max(50)
      .parse(await body(request));
    if (new Set(lines.map((l) => `${l.variantId}|${l.note ?? ""}`)).size !== lines.length)
      fail(400, "Duplicate cart lines");
    await env.DB.prepare(
      "INSERT INTO carts(owner,lines) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET lines=excluded.lines,updated_at=unixepoch()",
    )
      .bind(a.owner, JSON.stringify(lines))
      .run();
    return json({ saved: true });
  }
  if (path === "/api/profile" && method === "PATCH") {
    if (!a.userId) fail(401, "Sign in required");
    const input = z.object({ name: z.string().trim().min(1).max(200) }).parse(await body(request));
    await env.DB.prepare("UPDATE user SET name=?,updated_at=? WHERE id=?")
      .bind(input.name, Date.now(), a.userId)
      .run();
    return json({ saved: true });
  }
  if (path === "/api/addresses") {
    if (!a.userId) fail(401, "Sign in required");
    if (method === "GET")
      return json(
        (
          await env.DB.prepare("SELECT id,label,data FROM addresses WHERE user_id=? LIMIT 20")
            .bind(a.userId)
            .all()
        ).results,
      );
    if (method === "POST") {
      const input = z
        .object({ label: z.string().min(1).max(80), address: addressInput })
        .parse(await body(request));
      const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM addresses WHERE user_id=?")
        .bind(a.userId)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= 20) fail(400, "Address limit reached");
      const id = uuid();
      await env.DB.prepare("INSERT INTO addresses(id,user_id,label,data) VALUES(?,?,?,?)")
        .bind(id, a.userId, input.label, JSON.stringify(input.address))
        .run();
      return json({ id }, 201);
    }
  }
  if (path.startsWith("/api/addresses/") && method === "DELETE") {
    if (!a.userId) fail(401, "Sign in required");
    await env.DB.prepare("DELETE FROM addresses WHERE id=? AND user_id=?")
      .bind(path.split("/")[3], a.userId)
      .run();
    return json({ deleted: true });
  }
  if (path === "/api/orders" || path.startsWith("/api/orders/")) {
    await expire(env);
    if (path === "/api/orders" && method === "POST") return createOrder(request, env, a);
    if (path === "/api/orders" && method === "GET")
      return json(
        (
          await env.DB.prepare(
            "SELECT id,reference,status,total_kobo,created_at,expires_at,payment_method FROM orders WHERE owner=? ORDER BY created_at DESC LIMIT 100",
          )
            .bind(a.owner)
            .all()
        ).results,
      );
    const id = path.split("/")[3] ?? "";
    const order = await ownOrder(env, a, id);
    if (method === "GET") {
      const receipts = await orderReceipts(env, id);
      return json({
        ...order,
        items: (await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all())
          .results,
        payment: await env.DB.prepare("SELECT status FROM payments WHERE order_id=?")
          .bind(id)
          .first(),
        receipts,
        paymentStatus: customerPaymentStatus(
          order,
          receipts[0] ?? null,
          (
            await env.DB.prepare("SELECT outcome FROM bank_transfer_approvals WHERE order_id=?")
              .bind(id)
              .first<{ outcome: string }>()
          )?.outcome ?? null,
        ),
      });
    }
    if (method === "POST" && path === `/api/orders/${id}/receipts`)
      return submitReceipt(request, env, a, order);
    if (method === "POST" && path.endsWith("/cancel")) {
      await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'").bind(
          id,
        ),
        await audit(env, a, "order.cancel", id),
      ]);
      return json(await ownOrder(env, a, id));
    }
    if (method === "POST" && path.endsWith("/pay")) {
      if (!paymentEnabled(env)) fail(503, "Payments are disabled");
      if (order.status !== "pending") fail(409, "Order is not awaiting payment");
      if (order.payment_method !== "paystack")
        fail(409, "This order is paid by bank transfer, not online payment");
      await env.DB.prepare(
        "INSERT OR IGNORE INTO payments(reference,order_id,amount_kobo,currency,status) VALUES(?,?,?,'NGN','initialized')",
      )
        .bind(id, id, order.total_kobo)
        .run();
      const prior = await env.DB.prepare("SELECT authorization_url FROM payments WHERE reference=?")
        .bind(id)
        .first<{ authorization_url: string | null }>();
      if (prior?.authorization_url)
        return json({ authorization_url: prior.authorization_url, reference: id });
      try {
        const result = await initialize(env, order);
        await env.DB.prepare("UPDATE payments SET authorization_url=? WHERE reference=?")
          .bind(result.authorization_url, id)
          .run();
        return json(result);
      } catch {
        return fail(
          502,
          "Payment initialization unavailable. Retry this order; do not create another.",
        );
      }
    }
  }
  if (path.startsWith("/api/admin")) {
    requireRole(a, ["admin", "fulfilment"]);
    if (path === "/api/admin/overview" && method === "GET") {
      await expire(env);
      // One batched round trip. Catalogue and inventory figures exclude deleted products; stock
      // figures also exclude archived products (no longer for sale). variants.stock is AVAILABLE
      // stock: the reserve_stock trigger deducts units when an order is created and restore_stock
      // returns them on cancel/expiry, so reserved = units held by pending orders.
      const live = "p.deleted_at IS NULL AND p.status<>'archived'";
      const [catalogue, inventory, reserved, low, fulfilment, sales, review] = await env.DB.batch([
        env.DB.prepare(
          "SELECT COUNT(*) AS total,COALESCE(SUM(status='active'),0) AS published,COALESCE(SUM(status='draft'),0) AS drafts,COALESCE(SUM(status='archived'),0) AS archived FROM products p WHERE p.deleted_at IS NULL",
        ),
        env.DB.prepare(
          `SELECT COALESCE(SUM(v.stock),0) AS available,COALESCE(SUM(v.stock>0 AND v.stock<=v.low_stock),0) AS lowStock,COALESCE(SUM(v.stock=0),0) AS outOfStock,COUNT(*) AS variants FROM variants v JOIN products p ON p.id=v.product_id WHERE ${live}`,
        ),
        env.DB.prepare(
          "SELECT COALESCE(SUM(i.qty),0) AS reserved,COUNT(DISTINCT o.id) AS orders FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='pending'",
        ),
        env.DB.prepare(
          `SELECT v.id,v.sku,v.stock,v.low_stock,p.name FROM variants v JOIN products p ON p.id=v.product_id WHERE ${live} AND v.stock<=v.low_stock ORDER BY v.stock,p.name LIMIT 100`,
        ),
        env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('paid','processing')"),
        env.DB.prepare(
          "SELECT COUNT(*) AS orders,COALESCE(SUM(total_kobo),0) AS revenueKobo FROM orders WHERE status IN ('paid','processing','shipped','delivered')",
        ),
        env.DB.prepare(
          "SELECT COUNT(DISTINCT order_id) AS n FROM payment_receipts WHERE status='submitted'",
        ),
      ]);
      const one = (r: D1Result) => (r.results[0] ?? {}) as Record<string, number>;
      const c = one(catalogue!);
      const inv = one(inventory!);
      const res = one(reserved!);
      return json({
        // Existing keys, kept for compatibility.
        products: c["total"] ?? 0,
        lowStock: low!.results,
        sales: one(sales!),
        paymentsAwaitingReview: one(review!)["n"] ?? 0,
        // Business overview (2026-11-17).
        catalogue: {
          total: c["total"] ?? 0,
          published: c["published"] ?? 0,
          drafts: c["drafts"] ?? 0,
          archived: c["archived"] ?? 0,
        },
        inventory: {
          available: inv["available"] ?? 0,
          reserved: res["reserved"] ?? 0,
          reservedOrders: res["orders"] ?? 0,
          lowStockVariants: inv["lowStock"] ?? 0,
          outOfStockVariants: inv["outOfStock"] ?? 0,
          variants: inv["variants"] ?? 0,
        },
        ordersAwaitingFulfilment: one(fulfilment!)["n"] ?? 0,
      });
    }
    if (path === "/api/admin/orders" && method === "GET")
      return json(
        (await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all())
          .results,
      );
    if (path.startsWith("/api/admin/orders/") && method === "GET") {
      const id = path.split("/")[4] ?? "";
      const order = await ownOrder(env, a, id, true);
      return json({
        ...order,
        items: (await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all())
          .results,
        bankTransferApproval: await env.DB.prepare(
          "SELECT amount_kobo,bank_reference,outcome,approved_by,approved_at FROM bank_transfer_approvals WHERE order_id=?",
        )
          .bind(id)
          .first(),
      });
    }
    if (path.startsWith("/api/admin/orders/") && method === "PATCH") {
      const id = path.split("/")[4] ?? "";
      const order = await ownOrder(env, a, id, true);
      const input = z
        .object({ status: z.enum(["processing", "shipped", "delivered", "cancelled"]) })
        .parse(await body(request));
      const allowed: Record<string, string[]> = {
        pending: ["cancelled"],
        paid: ["processing"],
        processing: ["shipped"],
        shipped: ["delivered"],
      };
      if (!allowed[order.status]?.includes(input.status)) fail(409, "Invalid order transition");
      const result = await env.DB.batch([
        env.DB.prepare("UPDATE orders SET status=? WHERE id=? AND status=?").bind(
          input.status,
          id,
          order.status,
        ),
        await audit(env, a, `order.${input.status}`, id),
      ]);
      if (!result[0]?.meta.changes) fail(409, "Order changed; refresh");
      return json({ saved: true });
    }
    requireRole(a);
    // Payment review (admin only: requireRole above needs a verified WebAuthn admin session).
    if (path === "/api/admin/payment-review" && method === "GET") {
      await expire(env);
      const orders = (
        await env.DB.prepare(
          "SELECT o.id,o.reference,o.status,o.total_kobo,o.created_at,o.expires_at,json_extract(o.customer,'$.name') AS customer_name,json_extract(o.customer,'$.phone') AS customer_phone,(SELECT outcome FROM bank_transfer_approvals WHERE order_id=o.id) AS decision,CASE WHEN o.status='pending' AND EXISTS (SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.status='submitted') THEN 'active_receipt' WHEN o.status='pending' THEN 'active_awaiting' WHEN o.status='cancelled' THEN 'cancelled_review' ELSE 'expired_review' END AS queue_state FROM orders o WHERE o.payment_method='bank_transfer' AND (o.status='pending' OR EXISTS (SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.status='submitted')) ORDER BY EXISTS (SELECT 1 FROM payment_receipts r WHERE r.order_id=o.id AND r.status='submitted') DESC, o.created_at DESC LIMIT 200",
        ).all<{ id: string }>()
      ).results;
      const receipts = orders.length
        ? (
            await env.DB.prepare(
              "SELECT id,order_id,content_type,bytes,status,submitted_at,review_note FROM payment_receipts WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY submitted_at DESC, rowid DESC",
            )
              .bind(JSON.stringify(orders.map((o) => o.id)))
              .all<{ order_id: string }>()
          ).results
        : [];
      return json(
        orders.map((o) => ({ ...o, receipts: receipts.filter((r) => r.order_id === o.id) })),
      );
    }
    if (path.startsWith("/api/admin/receipts/") && method === "GET") {
      const receiptId = path.split("/")[4] ?? "";
      if (!hasReceiptStorage(env)) return fail(503, "Receipt storage is not configured");
      const row = await env.DB.prepare(
        "SELECT r.object_key,r.content_type,r.order_id,o.reference FROM payment_receipts r JOIN orders o ON o.id=r.order_id WHERE r.id=?",
      )
        .bind(receiptId)
        .first<{
          object_key: string;
          content_type: string;
          order_id: string;
          reference: string | null;
        }>();
      if (!row) return fail(404, "Receipt not found");
      const object = await env.RECEIPTS.get(row.object_key);
      if (!object) return fail(404, "Receipt file not found");
      await (await audit(env, a, "payment.receipt.viewed", row.order_id, { receiptId })).run();
      const extension = row.object_key.split(".").pop() ?? "bin";
      return new Response(object.body, {
        headers: receiptHeaders(row.content_type, row.reference ?? row.order_id, extension),
      });
    }
    if (path.startsWith("/api/admin/receipts/") && path.endsWith("/reject") && method === "POST") {
      const receiptId = path.split("/")[4] ?? "";
      const input = receiptRejectionInput.parse(await body(request));
      const row = await env.DB.prepare("SELECT order_id FROM payment_receipts WHERE id=?")
        .bind(receiptId)
        .first<{ order_id: string }>();
      if (!row) return fail(404, "Receipt not found");
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE payment_receipts SET status='rejected',reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='submitted'",
        ).bind(a.userId, nowSeconds(), input.reason, receiptId),
        env.DB.prepare(
          "INSERT INTO audit(actor,action,entity_id,detail) SELECT ?,'payment.receipt.rejected',?,? WHERE changes()=1",
        ).bind(a.userId, row.order_id, JSON.stringify({ receiptId, reason: input.reason })),
      ]);
      if (!results[0]?.meta.changes) fail(409, "This receipt has already been reviewed");
      return json({ status: "rejected" });
    }
    if (
      path.startsWith("/api/admin/orders/") &&
      path.endsWith("/bank-transfer-approval") &&
      method === "POST"
    ) {
      // Admin only: requireRole above needs a verified WebAuthn admin session (see actor()).
      const id = path.split("/")[4] ?? "";
      const input = bankTransferApprovalInput.parse(await body(request));
      await expire(env);
      const order = await ownOrder(env, a, id, true);
      if (order.payment_method !== "bank_transfer") fail(409, "Not a bank-transfer order");
      if (input.amountKobo !== order.total_kobo)
        fail(409, "Credited amount does not equal the order total; resolve manually");
      if (input.receiptId) {
        const receipt = await env.DB.prepare(
          "SELECT status FROM payment_receipts WHERE id=? AND order_id=?",
        )
          .bind(input.receiptId, id)
          .first<{ status: string }>();
        if (!receipt) fail(404, "Receipt not found for this order");
        if (receipt!.status !== "submitted") fail(409, "This receipt has already been reviewed");
      }
      const now = nowSeconds();
      const decisionId = uuid();
      // One transaction: record the decision (primary key = once per order), mark paid only when
      // the decision is 'paid', and audit. A late payment is recorded for manual review and never
      // reactivates the order or re-reserves stock. Approval does not touch inventory, so it
      // cannot double-count against a concurrent expiry (which restores stock exactly once).
      let recorded = 0;
      try {
        const results = await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO bank_transfer_approvals(order_id,decision_id,amount_kobo,bank_reference,outcome,approved_by,approved_at) SELECT id,?,?,?,CASE WHEN status='pending' AND expires_at>? THEN 'paid' ELSE 'late_review' END,?,? FROM orders WHERE id=? AND payment_method='bank_transfer' AND status IN ('pending','expired','cancelled')",
          ).bind(decisionId, input.amountKobo, input.bankReference, now, a.userId, now, id),
          env.DB.prepare(
            "UPDATE orders SET status='paid' WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM bank_transfer_approvals WHERE order_id=? AND outcome='paid')",
          ).bind(id, id),
          env.DB.prepare(
            "INSERT INTO audit(actor,action,entity_id,detail) SELECT ?,CASE outcome WHEN 'paid' THEN 'payment.bank_transfer.approved' ELSE 'payment.bank_transfer.late_review' END,order_id,json_object('amountKobo',amount_kobo,'bankReference',bank_reference,'creditConfirmed',1,'receiptId',?) FROM bank_transfer_approvals WHERE decision_id=?",
          ).bind(a.userId, input.receiptId ?? null, decisionId),
          // Close out submitted evidence only when this request recorded the decision.
          env.DB.prepare(
            "UPDATE payment_receipts SET status=CASE WHEN id=? THEN 'accepted' ELSE 'superseded' END,reviewed_by=?,reviewed_at=? WHERE order_id=? AND status='submitted' AND EXISTS (SELECT 1 FROM bank_transfer_approvals WHERE decision_id=?)",
          ).bind(input.receiptId ?? "", a.userId, now, id, decisionId),
        ]);
        recorded = results[0]?.meta.changes ?? 0;
      } catch {
        fail(409, "A payment decision is already recorded for this order");
      }
      const decision = await env.DB.prepare(
        "SELECT outcome FROM bank_transfer_approvals WHERE order_id=?",
      )
        .bind(id)
        .first<{ outcome: string }>();
      if (!recorded)
        fail(
          409,
          decision
            ? "A payment decision is already recorded for this order"
            : "This order cannot take a bank-transfer decision",
        );
      return json({ outcome: decision!.outcome });
    }
    if (path.startsWith("/api/admin/customers/") && path.endsWith("/revoke") && method === "POST") {
      const id = path.split("/")[4] ?? "";
      await env.DB.batch([
        env.DB.prepare("DELETE FROM session WHERE user_id=?").bind(id),
        await audit(env, a, "customer.sessions.revoked", id),
      ]);
      return json({ saved: true });
    }
    if (path === "/api/admin/business") {
      if (method === "GET") return json(await businessConfig(env));
      if (method === "POST") {
        const value = businessSettingsInput.parse(await body(request));
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO settings(key,value) VALUES('business',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).bind(JSON.stringify(value)),
          await audit(env, a, "business.updated", "business"),
        ]);
        return json({ saved: true });
      }
    }
    if (path.startsWith("/api/admin/products/") && method === "DELETE") {
      const id = path.split("/")[4] ?? "";
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE products SET status='archived',deleted_at=unixepoch() WHERE id=?",
        ).bind(id),
        await audit(env, a, "product.deleted", id),
      ]);
      return json({ deleted: true });
    }
    if (method === "GET") {
      if (path === "/api/admin/products") return json(await catalog(env, true));
      const tables: Record<string, string> = {
        categories: "categories",
        zones: "zones",
        banners: "banners",
        audit: "audit",
        inventory: "inventory_movements",
        payments: "payments",
        content: "content",
      };
      const table = tables[path.split("/")[3] ?? ""];
      if (table)
        return json((await env.DB.prepare(`SELECT * FROM ${table} LIMIT 500`).all()).results);
      if (path === "/api/admin/customers")
        return json(
          (await env.DB.prepare("SELECT id,name,email,email_verified FROM user LIMIT 200").all())
            .results,
        );
    }
    if (path === "/api/admin/products" && method === "POST") {
      const p = productInput.parse(await body(request));
      const id = p.id ?? uuid();
      if (
        p.status === "active" &&
        !(await env.DB.prepare("SELECT id FROM variants WHERE product_id=? LIMIT 1")
          .bind(id)
          .first())
      )
        fail(400, "Save as draft and add a priced option before publishing");
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO products(id,slug,name,category,description,age_groups,images,status,featured,seasonal,age_guidance,safety_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,category=excluded.category,description=excluded.description,age_groups=excluded.age_groups,images=excluded.images,status=excluded.status,featured=excluded.featured,seasonal=excluded.seasonal,age_guidance=excluded.age_guidance,safety_notes=excluded.safety_notes,updated_at=unixepoch()",
        ).bind(
          id,
          p.slug,
          p.name,
          p.category,
          p.description,
          JSON.stringify(p.ageGroups),
          JSON.stringify(p.images),
          p.status,
          Number(p.featured),
          Number(p.seasonal),
          p.ageGuidance,
          p.safetyNotes,
        ),
        await audit(env, a, "product.saved", id),
      ]);
      return json({ id });
    }
    if (path === "/api/admin/variants" && method === "POST") {
      const v = variantInput.parse(await body(request));
      const id = v.id ?? uuid();
      if (v.salePriceKobo != null && v.salePriceKobo >= v.priceKobo)
        fail(400, "Promotional price must be below the regular price");
      const existing = await env.DB.prepare("SELECT product_id FROM variants WHERE id=?")
        .bind(id)
        .first<{ product_id: string }>();
      if (existing && existing.product_id !== v.productId)
        fail(409, "Variant belongs to a different product");
      if (existing && v.openingStock) fail(400, "Use inventory adjustments for existing variants");
      // SKUs are unique: say so instead of letting the constraint surface as a generic error.
      if (
        await env.DB.prepare("SELECT 1 FROM variants WHERE sku=? AND id<>?").bind(v.sku, id).first()
      )
        fail(409, "That SKU is already used by another option. Choose a different SKU.");
      const statements = [
        env.DB.prepare(
          "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,low_stock,sale_price_kobo,stock) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,size=excluded.size,color=excluded.color,price_kobo=excluded.price_kobo,low_stock=excluded.low_stock,sale_price_kobo=excluded.sale_price_kobo",
        ).bind(
          id,
          v.productId,
          v.sku,
          v.size,
          v.color,
          v.priceKobo,
          v.lowStock,
          v.salePriceKobo ?? null,
          existing ? 0 : v.openingStock,
        ),
        await audit(env, a, "variant.saved", id),
      ];
      if (!existing && v.openingStock)
        statements.push(
          env.DB.prepare(
            "INSERT INTO inventory_movements(variant_id,delta,reason,actor) VALUES(?,?,'opening stock',?)",
          ).bind(id, v.openingStock, a.userId),
        );
      await env.DB.batch(statements);
      return json({ id });
    }
    if (path === "/api/admin/inventory" && method === "POST") {
      const s = stockInput.parse(await body(request));
      // CHECK stock>=0 makes concurrent deductions fail atomically. Only write the
      // movement when its associated update succeeds inside this same batch.
      await env.DB.batch([
        env.DB.prepare("UPDATE variants SET stock=stock+? WHERE id=?").bind(s.delta, s.variantId),
        env.DB.prepare(
          "INSERT INTO inventory_movements(variant_id,delta,reason,actor) VALUES(?,?,?,?)",
        ).bind(s.variantId, s.delta, s.reason, a.userId),
        await audit(env, a, "inventory.adjusted", s.variantId),
      ]);
      return json({ saved: true });
    }
    if (path === "/api/admin/categories" && method === "POST") {
      const c = z
        .object({
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(80),
          label: z.string().min(1).max(100),
        })
        .parse(await body(request));
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO categories(slug,label) VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET label=excluded.label",
        ).bind(c.slug, c.label),
        await audit(env, a, "category.saved", c.slug),
      ]);
      return json({ saved: true });
    }
    if (path === "/api/admin/zones" && method === "POST") {
      const v = zoneInput.parse(await body(request));
      const id = v.id ?? uuid();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO zones(id,name,state,fee_kobo,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,state=excluded.state,fee_kobo=excluded.fee_kobo,active=excluded.active",
        ).bind(id, v.name, v.state, v.feeKobo, Number(v.active)),
        await audit(env, a, "zone.saved", id),
      ]);
      return json({ id });
    }
    if (path === "/api/admin/banners" && method === "POST") {
      const v = bannerInput.parse(await body(request));
      const id = v.id ?? uuid();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO banners(id,title,href,image_url,active) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,href=excluded.href,image_url=excluded.image_url,active=excluded.active",
        ).bind(id, v.title, v.href, v.imageUrl, Number(v.active)),
        await audit(env, a, "banner.saved", id),
      ]);
      return json({ id });
    }
    if (path === "/api/admin/content" && method === "POST") {
      const v = policyInput.parse(await body(request));
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO content(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).bind(v.key, v.value),
        await audit(env, a, "content.saved", v.key),
      ]);
      return json({ saved: true });
    }
    if (path.startsWith("/api/admin/payments/") && path.endsWith("/refund") && method === "POST") {
      if (!paymentEnabled(env)) fail(503, "Payments are disabled");
      const reference = path.split("/")[4] ?? "";
      const payment = await env.DB.prepare("SELECT * FROM payments WHERE reference=?")
        .bind(reference)
        .first<{
          order_id: string;
          amount_kobo: number;
          status: string;
          provider_id: string;
          refund_id: string | null;
        }>();
      if (!payment) fail(404, "Payment not found");
      const input = z.object({ confirm: z.literal(true) }).parse(await body(request));
      if (payment.status === "refunded") return json({ status: "refunded" });
      if (payment.status === "paid" || payment.status === "review") {
        const reserved = await env.DB.batch([
          env.DB.prepare(
            "UPDATE payments SET status='refund_pending' WHERE reference=? AND status IN ('paid','review')",
          ).bind(reference),
          env.DB.prepare(
            "UPDATE orders SET status='refund_pending' WHERE id=? AND status IN ('paid','processing','shipped','delivered','cancelled','expired')",
          ).bind(payment.order_id),
          await audit(env, a, "refund.requested", reference),
        ]);
        if (!reserved[0]?.meta.changes)
          fail(409, "Refund already requested; reconcile before retrying");
        // Claim the operation durably before external I/O. If a request times out,
        // never issue another refund blindly: inspect provider state first.
        const refundId = await requestRefund(env, reference, payment.amount_kobo);
        await env.DB.prepare("UPDATE payments SET refund_id=? WHERE reference=?")
          .bind(refundId, reference)
          .run();
        return json({ status: "refund_pending" });
      }
      if (!payment.refund_id)
        fail(
          409,
          "Refund outcome unknown. Reconcile with Paystack; do not repeat the charge or refund.",
        );
      const status = await verifyRefund(
        env,
        payment.refund_id,
        payment.provider_id,
        payment.amount_kobo,
      );
      if (status === "processed")
        await env.DB.batch([
          env.DB.prepare("UPDATE payments SET status='refunded' WHERE reference=?").bind(reference),
          env.DB.prepare("UPDATE orders SET status='refunded' WHERE id=?").bind(payment.order_id),
          await audit(env, a, "refund.verified", reference),
        ]);
      // Returned goods require a separately audited physical-stock adjustment.
      return json({ status: status === "processed" ? "refunded" : "refund_pending" });
    }
    if (path.startsWith("/api/admin/payments/") && path.endsWith("/reconcile") && method === "POST")
      return json(await reconcile(env, path.split("/")[4] ?? ""));
  }
  if (path.startsWith("/api/admin/media/") && method === "GET") {
    requireRole(a);
    const key = path.slice("/api/admin/media/".length);
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(key) || !env.MEDIA) fail(404, "Image not found");
    const image = await env.MEDIA!.get(key);
    if (!image) fail(404, "Image not found");
    return new Response(image.body, {
      headers: {
        "Content-Type": image.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (path === "/api/admin/media" && method === "POST") {
    requireRole(a);
    if (!env.MEDIA) fail(503, "Image storage is not configured");
    const bytes = await bounded(request, 5 * 1024 * 1024);
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!png && !jpeg && !webp) fail(400, "Use a PNG, JPEG or WebP image");
    const extension = png ? "png" : jpeg ? "jpg" : "webp";
    const key = `${uuid()}.${extension}`;
    await env.MEDIA!.put(key, bytes, {
      httpMetadata: { contentType: `image/${extension === "jpg" ? "jpeg" : extension}` },
    });
    await (await audit(env, a, "media.uploaded", key)).run();
    return json({ url: `/media/${key}` }, 201);
  }
  return fail(404, "Endpoint not found");
}
export async function api(request: Request, env: CommerceEnv) {
  const requestId = uuid();
  let response: Response;
  try {
    response = await routes(request, env);
  } catch (error) {
    if (error instanceof HttpError || error instanceof SecurityError)
      response = json({ error: error.message, requestId }, error.status);
    else if (error instanceof SyntaxError)
      response = json({ error: "Invalid JSON", requestId }, 400);
    else if (error instanceof z.ZodError)
      response = json(
        {
          error: "Invalid input",
          fields: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          requestId,
        },
        400,
      );
    else {
      console.error(
        JSON.stringify({ event: "api.error", requestId, path: new URL(request.url).pathname }),
      );
      response = json({ error: "Request failed. Refresh and try again.", requestId }, 500);
    }
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  if (env.APP_ORIGIN.startsWith("https:"))
    headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("X-Request-Id", requestId);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  if (
    !request.headers.get("Cookie")?.includes("afnan_guest=") &&
    new URL(request.url).pathname === "/api/me"
  ) {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    headers.append(
      "Set-Cookie",
      `afnan_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${env.APP_ORIGIN.startsWith("https:") ? "; Secure" : ""}`,
    );
  }
  return new Response(response.body, { status: response.status, headers });
}

export const publicCatalog = (env: CommerceEnv) => catalog(env);

export async function businessConfig(env: CommerceEnv) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key='business'").first<{
    value: string;
  }>();
  if (!row) return business;
  const parsed = businessSettingsInput.safeParse(JSON.parse(row.value));
  if (!parsed.success) return business;
  return {
    ...business,
    ...parsed.data,
    whatsappUrl: `https://wa.me/${parsed.data.whatsapp.slice(1)}`,
    whatsappDisplay: parsed.data.whatsapp,
  };
}
