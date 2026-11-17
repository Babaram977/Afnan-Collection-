// Business overview accuracy (2026-11-17): catalogue counts (published/draft/archived, deleted
// excluded), available vs reserved stock (reserve_stock trigger), low/out of stock, orders awaiting
// fulfilment, receipts awaiting review, paid orders/sales, authorization, quick actions and layout.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const { mf, db, zoneId } = await createTestApp({
  port: 8787,
  bindings: {
    APP_ENV: "acceptance",
    CHECKOUT_ENABLED: "false",
    PAYMENT_MODE: "disabled",
    ADMIN_AUTH_MODE: "password",
  },
});
let checks = 0;
const eq = (a, b, m) => {
  assert.deepEqual(a, b, m);
  checks++;
};
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const browser = await chromium.launch();
try {
  // Harness already has one active product (romper, 1 variant, stock 5, alert 3).
  await db.batch([
    db.prepare(
      "INSERT INTO products(id,slug,name,category,status) VALUES('pa','ov-alpha','Overview Alpha','clothing','active'),('pb','ov-beta','Overview Beta','shoes','draft'),('pc','ov-old','Overview Old','toys','archived')",
    ),
    db.prepare(
      "INSERT INTO products(id,slug,name,category,status,deleted_at) VALUES('pd','ov-gone','Overview Gone','toys','active',unixepoch())",
    ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,stock,low_stock) VALUES('va1','pa','OV-A-1',100000,10,3),('va2','pa','OV-A-2',100000,2,3),('vb1','pb','OV-B-1',100000,0,3),('vc1','pc','OV-C-1',100000,50,3),('vd1','pd','OV-D-1',100000,7,3)",
    ),
  ]);
  const order = (id, status, total, extra = "") =>
    db
      .prepare(
        `INSERT INTO orders(id,owner,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,total_kobo,status,payment_method${extra ? ",expires_at" : ""}) VALUES(?,?,?,?,'f@example.com','{}','{}',?,0,?,?,'bank_transfer'${extra ? "," + extra : ""})`,
      )
      .bind(id, "guest:x", randomUUID(), "h", zoneId, total, status);
  // A real reservation: inserting the pending order's item fires reserve_stock (10 -> 7).
  await db.batch([
    order("o-pending", "pending", 300000, "unixepoch()+86400"),
    db.prepare(
      "INSERT INTO order_items(order_id,variant_id,name,sku,price_kobo,qty) VALUES('o-pending','va1','Overview Alpha','OV-A-1',100000,3)",
    ),
    order("o-paid", "paid", 500000),
    order("o-processing", "processing", 300000),
    order("o-shipped", "shipped", 200000),
    order("o-cancelled", "cancelled", 900000),
    order("o-refunded", "refunded", 800000),
    db.prepare(
      `INSERT INTO payment_receipts(id,order_id,object_key,content_type,bytes,sha256,submitted_at) VALUES('r1','o-pending','receipts/o-pending/r1.png','image/png',100,'${"a".repeat(64)}',unixepoch())`,
    ),
  ]);
  eq(
    await db.prepare("SELECT stock FROM variants WHERE id='va1'").first("stock"),
    7,
    "Reservation took 3 units",
  );

  // Authorization.
  const guest = new Client(mf);
  eq((await guest.request("/admin/overview")).status, 401, "Overview needs a session");
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  eq((await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status, 200);
  const admin = new Client(mf);
  eq(
    (await admin.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD }))
      .status,
    200,
  );
  const r = await admin.request("/admin/overview");
  eq(r.status, 200);
  const o = r.body;

  // Catalogue: deleted excluded; archived counted separately.
  eq(o.catalogue, { total: 4, published: 2, drafts: 1, archived: 1 }, "Catalogue counts");
  eq(o.products, 4, "Legacy products key consistent");
  // Inventory: archived and deleted excluded; available is after reservation.
  eq(o.inventory.available, 7 + 2 + 0 + 5, "Available = va1 7 + va2 2 + vb1 0 + romper 5");
  eq(o.inventory.reserved, 3, "Reserved units in pending orders");
  eq(o.inventory.reservedOrders, 1);
  eq(o.inventory.lowStockVariants, 1, "Low stock: va2 only (0 < 2 <= 3)");
  eq(o.inventory.outOfStockVariants, 1, "Out of stock: vb1 (archived vc1 excluded)");
  eq(o.inventory.variants, 4);
  eq(
    o.lowStock.map((v) => v.sku),
    ["OV-B-1", "OV-A-2"],
    "Low/out list excludes archived and deleted",
  );
  // Orders and money.
  eq(o.ordersAwaitingFulfilment, 2, "Paid + processing");
  eq(
    o.sales,
    { orders: 3, revenueKobo: 1000000 },
    "Paid/processing/shipped; cancelled and refunded excluded",
  );
  eq(o.paymentsAwaitingReview, 1, "One order with a submitted receipt");
  // Consistency with the Products module.
  const products = (await admin.request("/admin/products")).body;
  eq(products.length, o.catalogue.total, "Products module count matches");

  // Browser: phone and desktop.
  for (const width of [390, 1440]) {
    await db.prepare("DELETE FROM rate_limits").run();
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 50 : 51}` },
    });
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route(/\/api\/admin\/overview$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto(`${ORIGIN}/admin`);
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.locator("[data-overview-stats]").waitFor();
    ok(
      (await page.locator("[data-overview-stats]").innerText()).includes("…"),
      `Loading state shows … not zeros (${width})`,
    );
    release();
    await page.waitForFunction(
      () => !document.querySelector("[data-overview-stats]").innerText.includes("…"),
    );
    const value = async (label) =>
      (await page.locator(`[data-stat="${label}"] [data-stat-value]`).innerText()).trim();
    eq(await value("Available units"), "14");
    eq(await value("Reserved units"), "3");
    eq(await value("Low stock"), "1");
    eq(await value("Out of stock"), "1");
    eq(await value("Awaiting fulfilment"), "2");
    eq(await value("Awaiting review"), "1");
    eq(await value("Paid orders"), "3");
    eq(await value("Paid sales"), "₦10,000");
    eq(await value("Published"), "2");
    eq(await value("Drafts"), "1");
    ok(
      (await page.locator("[data-overview-stats]").innerText()).includes("Out of stock"),
      "Out-of-stock row labelled",
    );

    const actions = page.getByRole("navigation", { name: "Quick actions" }).getByRole("button");
    eq(await actions.count(), 6, "Six quick actions");
    const boxes = await Promise.all([0, 1, 2, 3].map((i) => actions.nth(i).boundingBox()));
    ok(
      width === 390
        ? Math.abs(boxes[0].y - boxes[2].y) < 2 && boxes[3].y > boxes[0].y + 10
        : boxes.every((b) => Math.abs(b.y - boxes[0].y) < 2),
      `Quick actions: 3 per row on phones, one row on desktop (${width})`,
    );
    ok(
      !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
      `No horizontal overflow (${width})`,
    );
    // Shortcuts open the existing sections.
    const go = async (label, check) => {
      await openAdminSection(page, "Overview");
      await page
        .getByRole("navigation", { name: "Quick actions" })
        .getByRole("button", { name: label })
        .click();
      await check();
    };
    await go("Add product", () => page.getByRole("heading", { name: "New product" }).waitFor());
    await go("View inventory", () => page.getByRole("heading", { name: "Adjust stock" }).waitFor());
    await go("Manage orders", () =>
      page.getByRole("heading", { name: "Customer orders", exact: true }).waitFor(),
    );
    await go("Review payments", () =>
      page.getByRole("heading", { name: "Bank-transfer payments" }).waitFor(),
    );
    await go("Manage categories", () =>
      page.getByRole("heading", { name: "categories", exact: true }).waitFor(),
    );
    await go("Manage banners", () =>
      page.getByRole("heading", { name: "banners", exact: true }).waitFor(),
    );
    ok(true, "All six shortcuts open their sections");
    await page.close();
  }
  // Error state: a failing overview surfaces an alert, not silent zeros.
  {
    await db.prepare("DELETE FROM rate_limits").run();
    const page = await browser.newPage({
      viewport: { width: 390, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.52" },
    });
    await page.route(/\/api\/admin\/overview$/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"Overview unavailable"}',
      }),
    );
    await page.goto(`${ORIGIN}/admin`);
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").filter({ hasText: "Overview unavailable" }).waitFor();
    ok(
      (await page.locator("[data-overview-stats]").innerText()).includes("…"),
      "No fake zeros on error",
    );
    await page.close();
  }
  console.log(
    `PASS: ${checks} business overview accuracy, authorization, quick-action and layout checks`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
