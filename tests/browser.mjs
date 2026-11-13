import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN } from "./harness.mjs";
const { mf, db, zoneId } = await createTestApp({ port: 8787 });
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [390, 768, 1440]) {
    await db.prepare("DELETE FROM rate_limits").run();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `192.0.2.${[390, 768, 1440].indexOf(width) + 20}` },
    });
    const page = await context.newPage();
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
  await page.getByLabel("Product name", { exact: true }).fill("Browser draft fixture");
  await page.getByLabel("URL slug").fill("browser-draft-fixture");
  await page.getByLabel("Category slug").fill("clothing");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("cell", { name: "Browser draft fixture", exact: true }).waitFor();
  checks++;
  assert.ok(
    await db
      .prepare("SELECT id FROM products WHERE slug='browser-draft-fixture' AND status='draft'")
      .first(),
  );
  checks++;
  await page.getByRole("button", { name: "Zones", exact: true }).click();
  await page.getByLabel("Area name").fill("Browser fixture delivery");
  await page.getByLabel("State (e.g. Kano)").fill("Kano");
  await page.getByLabel("Delivery charge in kobo").fill("60000");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("cell", { name: "Browser fixture delivery", exact: true }).waitFor();
  checks++;
  await context.close();
  console.log(
    `PASS: ${checks} responsive browser, checkout, staff CRUD and accessibility checks at 390/768/1440 px (fixtures only)`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
