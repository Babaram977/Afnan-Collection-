import { business } from "../lib/business";
import { z } from "zod";
import type { Product, CategorySlug, AgeGroup } from "../lib/catalog";
import { authFor } from "./auth";
import { adminProof, adminSecurity, SecurityError, securityLimit, digest } from "./admin-security";
import type { CommerceEnv } from "./types";
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
} from "./validation";
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
      role: staff && (await adminProof(request, env, session)) ? staff.role : null,
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
function requireRole(a: Actor, roles = ["admin"]) {
  if (!a.userId) fail(401, "Sign in required");
  if (!a.role || !roles.includes(a.role)) fail(403, "Staff access required");
}
async function audit(env: CommerceEnv, a: Actor, action: string, id: string) {
  return env.DB.prepare("INSERT INTO audit(actor,action,entity_id) VALUES(?,?,?)").bind(
    a.userId ?? a.owner,
    action,
    id,
  );
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
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<=unixepoch()",
    ),
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
    return json(existing);
  }
  const zone = await env.DB.prepare(
    "SELECT * FROM zones WHERE id=? AND active=1 AND lower(state)=lower(?)",
  )
    .bind(input.zoneId, input.address.state)
    .first<{ fee_kobo: number }>();
  if (!zone) fail(400, "Delivery is unavailable for this address");
  const id = uuid();
  const statements = [
    env.DB.prepare(
      "INSERT INTO orders(id,owner,user_id,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo) VALUES(?,?,?,?,?,?,?,?,?,?)",
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
  statements.push(await audit(env, a, "order.created", id));
  try {
    await env.DB.batch(statements);
  } catch {
    const replay = await env.DB.prepare("SELECT * FROM orders WHERE owner=? AND idempotency_key=?")
      .bind(a.owner, input.idempotencyKey)
      .first<OrderRow>();
    if (replay && replay.request_hash === requestHash) return json(replay);
    return fail(409, "Stock changed or this request conflicts. Refresh your cart.");
  }
  return json(await ownOrder(env, a, id), 201);
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
    ];
    if (!allowed.includes(path)) fail(404, "Not found");
    await limited(request, env, "auth", 15);
    if (method === "POST") {
      const data = await bounded(request);
      if (path === "/api/auth/email-otp/send-verification-otp") {
        const parsed = z
          .object({ email: z.string().email().max(254), type: z.literal("sign-in") })
          .parse(JSON.parse(new TextDecoder().decode(data)));
        if (typeof parsed.email === "string") {
          const email = parsed.email.trim().toLowerCase();
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
      if (!response.ok && path === "/api/auth/email-otp/send-verification-otp") {
        // Do not expose account existence via provider failures. Delivery monitoring is separate.
        console.error(JSON.stringify({ event: "auth.email.unavailable" }));
        return json({ success: true });
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
  if (path.startsWith("/api/admin-security/")) {
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
    return json({ userId: a.userId, email: a.email, role: a.role });
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
      .array(z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
      .max(50)
      .parse(await body(request));
    if (new Set(lines.map((l) => l.variantId)).size !== lines.length)
      fail(400, "Duplicate variants");
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
            "SELECT id,status,total_kobo,created_at,expires_at FROM orders WHERE owner=? ORDER BY created_at DESC LIMIT 100",
          )
            .bind(a.owner)
            .all()
        ).results,
      );
    const id = path.split("/")[3] ?? "";
    const order = await ownOrder(env, a, id);
    if (method === "GET")
      return json({
        ...order,
        items: (await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all())
          .results,
        payment: await env.DB.prepare("SELECT status FROM payments WHERE order_id=?")
          .bind(id)
          .first(),
      });
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
      return json({
        products: (await catalog(env, true)).length,
        lowStock: (
          await env.DB.prepare(
            "SELECT id,sku,stock,low_stock FROM variants WHERE stock<=low_stock LIMIT 100",
          ).all()
        ).results,
        sales: await env.DB.prepare(
          "SELECT COUNT(*) AS orders,COALESCE(SUM(total_kobo),0) AS revenueKobo FROM orders WHERE status IN ('paid','processing','shipped','delivered')",
        ).first(),
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
