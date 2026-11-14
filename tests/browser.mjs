import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN, AUTH_SECRET } from "./harness.mjs";
const { mf, db, zoneId } = await createTestApp({ port: 8787 });
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of process.env.TEST_DESKTOP_ONLY ? [1440] : [390, 768, 1440]) {
    await db.prepare("DELETE FROM rate_limits").run();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `192.0.2.${[390, 768, 1440].indexOf(width) + 20}` },
    });
    const page = await context.newPage();
    // Exercise robust layout when external font CDNs are unavailable, as in CI.
    if (width === 768)
      await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    const errors = [];
    page.on("response", async (r) => {
      if (r.url().includes("/api/") && r.status() >= 400)
        console.log("HTTP", r.status(), r.url(), await r.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${ORIGIN}/shop`);
    await page.getByText("Test fixture romper", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Shop overflow at ${width}`,
    );
    checks++;
    await page
      .getByRole("link", { name: /Test fixture romper/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto(`${ORIGIN}/cart`);
    await page.getByText("Test fixture romper", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Increase Test fixture romper" }).click();
    await page.reload();
    await page.locator("#main").getByText("2", { exact: true }).waitFor();
    checks++;
    await page.getByRole("link", { name: "Continue to checkout" }).click();
    await page.getByLabel("Delivery area").selectOption(zoneId);
    await page.getByLabel("Full name", { exact: true }).fill("Browser fixture buyer");
    await page.getByLabel("Phone", { exact: true }).fill("08012345678");
    await page.getByLabel("Email", { exact: true }).fill(`browser-${width}@example.com`);
    await page.getByLabel("Street address", { exact: true }).fill("Fixture street 10");
    await page.getByLabel("City", { exact: true }).fill("Kano");
    await page.getByRole("button", { name: "Prepare order", exact: true }).click();
    try {
      await page.getByRole("heading", { name: "Order prepared" }).waitFor({ timeout: 10000 });
    } catch (e) {
      console.log(await page.locator("#main").innerText());
      console.log(
        "valid",
        await page.locator("form").evaluate((f) =>
          [...f.querySelectorAll("input,select")].map((i) => ({
            name: i.id,
            value: i.value,
            valid: i.checkValidity(),
            message: i.validationMessage,
          })),
        ),
      );
      throw e;
    }
    checks++;
    await page.getByRole("link", { name: "Track your order" }).click();
    await page.getByRole("button", { name: "Cancel reservation" }).click();
    await page.getByText("cancelled", { exact: true }).waitFor();
    checks++;
    for (const path of [
      "/",
      "/shop",
      "/cart",
      "/checkout",
      "/account",
      "/admin",
      "/policies",
      "/contact",
    ]) {
      await page.goto(`${ORIGIN}${path}`);
      await page.waitForLoadState("networkidle");
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        `${path} accessibility at ${width}`,
      );
      checks++;
      if (path === "/contact") {
        assert.equal(await page.locator('main a[href="https://wa.me/2347035963225"]').count(), 1);
        assert.equal(
          await page.locator('main a[href="https://www.instagram.com/afnan_collectionkn"]').count(),
          1,
        );
        assert.equal(
          await page.locator('main a[href="https://www.tiktok.com/@afnan_collectionkn"]').count(),
          1,
        );
        assert.ok(
          (await page.locator("main").innerText()).includes(
            "11 Shehu Naallah Street, Hadejia Road, Kano, Nigeria",
          ),
        );
        checks += 4;
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${path} overflow at ${width}`,
      );
      checks++;
    }

    if (width === 390) {
      await page.goto(ORIGIN + "/product/fixture-romper");
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();
      await page.goto(ORIGIN + "/cart");
      await page.getByText("Test fixture romper", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(async () => {
          const lines = JSON.parse(localStorage.getItem("afnan-cart-v1"));
          return (
            await fetch("/api/cart", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(lines.map(({ variantId, qty }) => ({ variantId, qty }))),
            })
          ).status;
        }),
        200,
      );
      await page.getByRole("button", { name: "Remove Test fixture romper", exact: true }).click();
      await page.reload();
      await page.getByRole("heading", { name: "Your cart is empty", exact: true }).waitFor();
      checks++;
      await page.goto(ORIGIN + "/product/fixture-romper");
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();
      const stored = await page.evaluate(() => localStorage.getItem("afnan-cart-v1"));
      const unavailable = async (route) =>
        route.request().method() === "GET" ? route.abort() : route.continue();
      await page.route("**/api/cart", unavailable);
      await page.goto(ORIGIN + "/cart");
      await page.getByRole("alert").filter({ hasText: "Cart unavailable" }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem("afnan-cart-v1")), stored);
      checks++;
      await page.unroute("**/api/cart", unavailable);
      await page.reload();
      await page.getByText("Test fixture romper", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Remove Test fixture romper", exact: true }).click();
      checks++;
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}`);
    checks++;
    await context.close();
  }
  await db.prepare("DELETE FROM rate_limits").run();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.30" },
  });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/admin`);
  await page.getByLabel("Email", { exact: true }).fill("browser-admin@example.com");
  await page.getByLabel("Name", { exact: true }).fill("Browser admin");
  await page.getByRole("button", { name: "Send sign-in code" }).click();
  await page.getByLabel("Email code").waitFor();
  const { code } = await db
    .prepare("SELECT code FROM test_outbox WHERE email=?")
    .bind("browser-admin@example.com")
    .first();
  await page.getByLabel("Email code").fill(code);
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await page.getByText("Staff access is required.", { exact: false }).waitFor();
  await db
    .prepare(
      "INSERT INTO staff(user_id,role) SELECT id,'admin' FROM user WHERE email='browser-admin@example.com'",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO admin_security(user_id,state,approval_ref,verified_by) SELECT id,'pending','fixture-evidence','fixture-operator' FROM user WHERE email='browser-admin@example.com'",
    )
    .run();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "usb",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "Enroll passkey or security key" }).click();
  await page.getByRole("button", { name: "I saved my recovery codes" }).click();
  await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  checks++;

  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Browser draft fixture");
  await page.getByLabel("Product link name").fill("browser-draft-fixture");
  await page.getByLabel("Category", { exact: true }).selectOption("clothing");
  const photo = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      canvas.getContext("2d").fillRect(0, 0, 8, 8);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page.getByLabel("Upload product photographs").setInputFiles([
    { name: "fixture-one.png", mimeType: "image/png", buffer: photo },
    { name: "fixture-two.png", mimeType: "image/png", buffer: photo },
  ]);
  await page.waitForFunction(
    () => document.querySelectorAll('img[src^="/api/admin/media/"]').length === 2,
  );
  checks++;
  await page.getByRole("button", { name: "Make main image", exact: true }).click();
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await page.getByRole("heading", { name: "Prices, sizes, colours and stock" }).waitFor();
  checks++;
  await page.getByLabel("Unique SKU").fill("BROWSER-001");
  await page.getByLabel("Regular price (₦)", { exact: true }).fill("2500");
  await page.getByLabel("Promotional price (₦, optional)", { exact: true }).fill("2000");
  await page.getByLabel("Opening stock quantity").fill("4");
  await page.getByRole("button", { name: "Save option", exact: true }).click();
  await page.getByText(/BROWSER-001.*4 available/).waitFor();
  checks++;
  await page.getByLabel("Visibility").selectOption("active");
  const published = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/products") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  assert.equal((await published).status(), 200);
  checks++;
  const row = await db
    .prepare(
      "SELECT p.id,v.stock,v.sale_price_kobo,p.images FROM products p JOIN variants v ON v.product_id=p.id WHERE p.slug='browser-draft-fixture'",
    )
    .first();
  assert.equal(row.stock, 4);
  assert.equal(row.sale_price_kobo, 200000);
  assert.equal(JSON.parse(row.images).length, 2);
  checks += 3;

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
      `Authenticated product editor accessibility at ${width}`,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Product editor overflow at ${width}`,
    );
    checks += 2;
  }

  await page.getByRole("button", { name: "Back to products", exact: true }).click();
  const productCard = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "Browser draft fixture", exact: true }) });
  await productCard.getByRole("button", { name: "Edit product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill("Browser updated fixture");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Updated product description for controlled acceptance.");
  const edited = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/products") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  assert.equal((await edited).status(), 200);
  checks++;
  await page.getByRole("button", { name: "Edit option", exact: true }).click();
  await page.getByLabel("Regular price (₦)", { exact: true }).fill("2600.50");
  await page.getByLabel("Promotional price (₦, optional)", { exact: true }).fill("2100.25");
  const optionUpdated = page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/variants") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save option", exact: true }).click();
  assert.equal((await optionUpdated).status(), 200);
  checks++;
  const adjusted = await db
    .prepare("SELECT stock,price_kobo,sale_price_kobo FROM variants WHERE sku='BROWSER-001'")
    .first();
  assert.equal(adjusted.stock, 4);
  assert.equal(adjusted.price_kobo, 260050);
  assert.equal(adjusted.sale_price_kobo, 210025);
  checks += 3;
  const catalogPage = await context.newPage();
  await catalogPage.goto(ORIGIN + "/product/browser-draft-fixture");
  await catalogPage
    .getByRole("heading", { name: "Browser updated fixture", exact: true })
    .waitFor();
  await catalogPage.getByText(/2,100\.25/).waitFor();
  checks++;
  await catalogPage.close();
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page
    .getByLabel("Product and option")
    .selectOption({ label: "Browser updated fixture — BROWSER-001 — 4 available" });
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await page.getByLabel("Reason", { exact: true }).fill("Fixture count correction");
  await page.getByRole("button", { name: "Record stock movement" }).click();
  await page.getByText("Stock updated and movement recorded.").waitFor();
  checks++;
  await page.getByRole("button", { name: "Zones", exact: true }).click();
  await page.getByLabel("Area name").fill("Browser fixture delivery");
  await page.getByLabel("State (e.g. Kano)").fill("Kano");
  await page.getByLabel("Delivery charge (₦)").fill("600");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("cell", { name: "Browser fixture delivery", exact: true }).waitFor();
  checks++;

  const customerContext = await browser.newContext({
    viewport: { width: 390, height: 900 },
    extraHTTPHeaders: { "CF-Connecting-IP": "192.0.2.31" },
  });
  try {
    const customerPage = await customerContext.newPage();
    await customerPage.goto(ORIGIN + "/account");
    await customerPage.getByLabel("Email", { exact: true }).fill("acceptance-customer@example.com");
    await customerPage.getByLabel("Name", { exact: true }).fill("Acceptance customer");
    await customerPage.getByRole("button", { name: "Send sign-in code" }).click();
    await customerPage.getByLabel("Email code").waitFor();
    const { code } = await db
      .prepare("SELECT code FROM test_outbox WHERE email=?")
      .bind("acceptance-customer@example.com")
      .first();
    await customerPage.getByLabel("Email code").fill(code);
    await customerPage.getByRole("button", { name: "Verify and sign in" }).click();
    await customerPage
      .getByRole("heading", { name: "Signed in as acceptance-customer@example.com" })
      .waitFor();
    checks++;

    let releaseCart;
    const cartGate = new Promise((resolve) => {
      releaseCart = resolve;
    });
    const holdCart = async (route) => {
      if (route.request().method() === "GET") await cartGate;
      await route.continue();
    };
    await customerPage.route("**/api/cart", holdCart);
    const cartRequested = customerPage.waitForRequest(
      (r) => r.url().endsWith("/api/cart") && r.method() === "GET",
    );
    await customerPage.goto(ORIGIN + "/product/browser-draft-fixture");
    await cartRequested;
    assert.equal(
      await customerPage.getByRole("button", { name: "Add to cart", exact: true }).isDisabled(),
      true,
    );
    checks++;
    releaseCart();
    await customerPage.getByRole("button", { name: "Add to cart", exact: true }).click();
    await customerPage.unroute("**/api/cart", holdCart);
    await customerPage.goto(ORIGIN + "/checkout");
    await customerPage.getByLabel("Delivery area").selectOption(zoneId);
    await customerPage.getByLabel("Full name", { exact: true }).fill("Acceptance customer");
    await customerPage.getByLabel("Phone", { exact: true }).fill("08012345678");
    await customerPage
      .getByLabel("Street address", { exact: true })
      .fill("Acceptance fixture street 10");
    await customerPage.getByLabel("City", { exact: true }).fill("Kano");
    await customerPage.getByRole("button", { name: "Prepare order", exact: true }).click();
    await customerPage.getByRole("heading", { name: "Order prepared" }).waitFor();
    const order = await db
      .prepare(
        "SELECT id,total_kobo,user_id FROM orders WHERE email='acceptance-customer@example.com' AND status='pending'",
      )
      .first();
    assert.ok(order.user_id);
    assert.equal(order.total_kobo, 260025);
    checks += 2;
    await customerPage.getByRole("button", { name: "Continue to payment", exact: true }).click();
    await customerPage.waitForURL(/\/account/);
    checks++;
    const event = JSON.stringify({ event: "charge.success", data: { reference: order.id } });
    const signature = createHmac("sha512", AUTH_SECRET).update(event).digest("hex");
    const paid = await mf.dispatchFetch(ORIGIN + "/api/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
      body: event,
    });
    assert.equal(paid.status, 200);
    checks++;
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page.getByLabel("Show orders").selectOption("paid");
    const orderCard = page.getByRole("listitem").filter({ hasText: order.id });
    await orderCard
      .getByRole("button", { name: "View purchased items and delivery", exact: true })
      .click();
    await page.getByText("Acceptance fixture street 10, Kano, Kano", { exact: true }).waitFor();
    await page.getByText(/1 × Browser updated fixture \(BROWSER-001\)/).waitFor();
    checks++;
    await page.getByRole("button", { name: "Start fulfilment", exact: true }).click();
    await page.getByRole("button", { name: "Mark dispatched", exact: true }).click();
    await page.getByRole("button", { name: "Mark delivered", exact: true }).click();
    await page.getByText("Status: delivered", { exact: true }).waitFor();
    checks++;
    await customerPage.getByRole("button", { name: "Refresh order status", exact: true }).click();
    await customerPage.getByText("delivered", { exact: true }).waitFor();
    checks++;
    const balance = await db.prepare("SELECT stock FROM variants WHERE sku='BROWSER-001'").first();
    assert.equal(balance.stock, 5);
    checks++;
  } finally {
    await customerContext.close();
  }
  await page.getByRole("button", { name: "Business", exact: true }).click();
  await page
    .getByLabel("Business address", { exact: true })
    .fill("Fixture updated business address in Kano");
  await page.getByRole("button", { name: "Save business contacts" }).click();
  await page.getByText("Business contacts updated.").waitFor();
  await page.goto(ORIGIN + "/contact");
  await page
    .locator("main")
    .getByText("Fixture updated business address in Kano", { exact: true })
    .waitFor();
  checks++;
  await context.close();
  console.log(
    `PASS: ${checks} responsive browser, checkout, staff CRUD and accessibility checks at 390/768/1440 px (fixtures only)`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
