import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN } from "./harness.mjs";
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
  await page.reload();
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
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  await page
    .getByLabel("Product and option")
    .selectOption({ label: "Browser draft fixture — BROWSER-001 — 4 available" });
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
