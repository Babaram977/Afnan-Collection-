import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
export const ORIGIN = "http://localhost:8787";
export const AUTH_SECRET = "local-test-only-secret-with-at-least-32-characters";
// Every migration, in order. A test may start from an older schema (options.migrations) and then
// upgrade with applyMigrations(), to prove a migration against data written by the previous release.
export const MIGRATIONS = [
  "0001_commerce.sql",
  "0002_admin_management.sql",
  "0003_administrator_mfa.sql",
  "0004_bank_transfer_reservation.sql",
  "0005_payment_receipts.sql",
  "0006_session_authentication_method.sql",
  "0007_fulfilment_options.sql",
  "0008_order_tracking_notifications.sql",
];
export async function applyMigrations(db, files) {
  let sql = "";
  for (const file of files) sql += (await readFile(`migrations/${file}`, "utf8")) + "\n";
  sql = sql.replace(/--[^\n]*/g, "");
  const statements = [];
  let statement = "";
  let trigger = false;
  for (const raw of sql.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (!statement) trigger = line.startsWith("CREATE TRIGGER");
    statement += " " + line;
    if ((trigger && line === "END;") || (!trigger && line.endsWith(";"))) {
      statements.push(statement);
      statement = "";
      trigger = false;
    }
  }
  for (const statement of statements) await db.prepare(statement.trim()).run();
}
export async function createTestApp(options = {}) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "afnan-test",
          modules: true,
          scriptPath: ".worker-build/worker.js",
          compatibilityDate: "2026-11-13",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          r2Buckets: ["MEDIA", "RECEIPTS"],
          assets: {
            directory: ".output/public",
            binding: "ASSETS",
            routerConfig: { invoke_user_worker_ahead_of_assets: true, has_user_worker: true },
          },
          bindings: {
            APP_ENV: "test",
            APP_ORIGIN: ORIGIN,
            AUTH_SECRET,
            CHECKOUT_ENABLED: "true",
            PAYMENT_MODE: "fixture",
            TEST_FIXTURES: "true",
            // Existing fixtures place orders through the pre-#41 zone path; deployed stores never set this.
            LEGACY_ZONE_ORDERS: "enabled",
            ...options.bindings,
          },
          ...(options.outboundService ? { outboundService: options.outboundService } : {}),
        },
      ],
      ...(options.port ? { port: options.port } : {}),
    }),
  );
  await mf.ready;
  const db = await mf.getD1Database("DB");
  await applyMigrations(db, options.migrations ?? MIGRATIONS);
  for (const statement of (await readFile("tests/fixtures.sql", "utf8"))
    .split(";")
    .filter((s) => s.trim()))
    await db.prepare(statement.trim()).run();
  const productId = randomUUID(),
    variantId = randomUUID(),
    zoneId = randomUUID();
  await db.batch([
    db
      .prepare(
        "INSERT INTO products(id,slug,name,category,age_groups,status,featured) VALUES(?,'fixture-romper','Test fixture romper','clothing','[\"baby\"]','active',1)",
      )
      .bind(productId),
    db
      .prepare(
        "INSERT INTO variants(id,product_id,sku,size,price_kobo,stock) VALUES(?,?,'FIXTURE-001','M',250000,5)",
      )
      .bind(variantId, productId),
    db
      .prepare(
        "INSERT INTO zones(id,name,state,fee_kobo,active) VALUES(?,'Test Kano area','Kano',50000,1)",
      )
      .bind(zoneId),
  ]);
  return { mf, db, productId, variantId, zoneId };
}
let clientCounter = 0;
export class Client {
  constructor(mf, origin = ORIGIN) {
    this.mf = mf;
    this.origin = origin;
    this.ip = `192.0.2.${++clientCounter}`;
    this.cookies = new Map();
  }
  async request(path, method = "GET", data, headers = {}) {
    const response = await this.mf.dispatchFetch(`${this.origin}/api${path}`, {
      method,
      headers: {
        Origin: this.origin,
        "CF-Connecting-IP": this.ip,
        "Content-Type": "application/json",
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
        ...headers,
      },
      ...(data === undefined
        ? {}
        : {
            body:
              typeof data === "string" ||
              data instanceof Uint8Array ||
              data instanceof ReadableStream
                ? data
                : JSON.stringify(data),
            ...(data instanceof ReadableStream ? { duplex: "half" } : {}),
          }),
    });
    for (const c of response.headers.getSetCookie()) {
      const [name, value] = c.split(";")[0].split("=");
      this.cookies.set(name, value);
    }
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, body, headers: response.headers };
  }
  async signIn(db, email = "fixture@example.com") {
    const sent = await this.request("/auth/email-otp/send-verification-otp", "POST", {
      email,
      type: "sign-in",
    });
    if (sent.status !== 200) throw new Error(JSON.stringify(sent));
    const { code } = await db
      .prepare("SELECT code FROM test_outbox WHERE email=?")
      .bind(email)
      .first();
    const result = await this.request("/auth/sign-in/email-otp", "POST", {
      email,
      otp: code,
      name: "Fixture user",
    });
    if (result.status !== 200) throw new Error(JSON.stringify(result));
    return (await this.request("/me")).body;
  }
}
// Select an administrator section on either layout: the phone "Sections" panel or the desktop row.
export async function openAdminSection(page, name) {
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const trigger = page.getByRole("button", { name: "Admin sections" });
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name, exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  } else {
    await page
      .getByRole("navigation", { name: "Administration", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
  }
}
