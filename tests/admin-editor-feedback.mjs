// Admin product editor usability (2026-11-21 audit): saving a product or option confirms success;
// option errors appear beside the option form (on a phone the product alert is off-screen); photos
// can be moved earlier/later, not only to the front; a double tap on "Save product" for a new
// product creates one product, not two.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const PHOTOS = [
  "aaaaaaaa-0000-4000-8000-000000000001.png",
  "aaaaaaaa-0000-4000-8000-000000000002.png",
  "aaaaaaaa-0000-4000-8000-000000000003.png",
];
const PID = "88888888-8888-4888-8888-888888888888";
const { mf, db } = await createTestApp({
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
  await db.batch([
    db
      .prepare(
        "INSERT INTO products(id,slug,name,category,status,images) VALUES(?,'fx-editor','Fixture Editor','clothing','draft',?)",
      )
      .bind(
        PID,
        JSON.stringify(PHOTOS.map((k, i) => ({ url: `/media/${k}`, alt: `Photo ${i + 1}` }))),
      ),
    db.prepare(
      `INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('99999999-9999-4999-8999-999999999999','${PID}','FX-ED-1',100000,5)`,
    ),
  ]);
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.70" },
  });
  await page.goto(`${ORIGIN}/admin?setup=${token}`);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set password" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  await openAdminSection(page, "Products");
  await page
    .locator("[data-product-list] li", { hasText: "Fixture Editor" })
    .getByRole("button", { name: "Edit product" })
    .click();
  await page.getByLabel("Photo description").first().waitFor();

  // Photo ordering.
  const alts = () =>
    page.getByLabel("Photo description").evaluateAll((els) => els.map((e) => e.value));
  eq(await alts(), ["Photo 1", "Photo 2", "Photo 3"]);
  ok(
    await page.getByRole("button", { name: "Move earlier: photo 1 of 3" }).isDisabled(),
    "First cannot move earlier",
  );
  ok(
    await page.getByRole("button", { name: "Move later: photo 3 of 3" }).isDisabled(),
    "Last cannot move later",
  );
  await page.getByRole("button", { name: "Move later: photo 1 of 3" }).click();
  eq(await alts(), ["Photo 2", "Photo 1", "Photo 3"], "Move later swaps with the next photo");
  await page.getByRole("button", { name: "Move earlier: photo 3 of 3" }).click();
  eq(await alts(), ["Photo 2", "Photo 3", "Photo 1"], "Move earlier swaps with the previous photo");

  // Product save confirms success, and the order is what was saved.
  await page.getByRole("button", { name: "Save product" }).click();
  const saved = page.locator("[data-product-saved]");
  await saved.waitFor();
  eq(await saved.innerText(), "Product saved.");
  eq(await saved.getAttribute("role"), "status", "Announced to screen readers");
  const stored = JSON.parse(
    await db.prepare("SELECT images FROM products WHERE id=?").bind(PID).first("images"),
  );
  eq(
    stored.map((i) => i.alt),
    ["Photo 2", "Photo 3", "Photo 1"],
    "Saved photo order",
  );

  // Option feedback appears beside the option form, visible on a phone.
  await page.getByLabel("Unique SKU").fill("FX-ED-1"); // duplicate SKU: rejected by the server
  await page.getByLabel("Regular price (₦)").fill("1500");
  await page.getByRole("button", { name: "Save option" }).click();
  const feedback = page.locator("[data-variant-feedback]");
  await feedback.waitFor();
  eq(await feedback.getAttribute("role"), "alert", "Option error is an alert");
  eq(
    await feedback.innerText(),
    "That SKU is already used by another option. Choose a different SKU.",
    "Duplicate SKU explained",
  );
  ok(
    (await page.getByText("FX-ED-1 · ₦1,000 · 5 available", { exact: true }).count()) === 1,
    "Option without size/colour listed without empty separators",
  );
  ok(await feedback.isVisible(), "Option error is next to the form");
  const box = await feedback.boundingBox();
  const button = await page.getByRole("button", { name: "Save option" }).boundingBox();
  ok(Math.abs(box.y - button.y) < 200, "Error sits beside the Save option button, not at the top");
  await page.getByLabel("Unique SKU").fill("FX-ED-2");
  await page.getByLabel("Regular price (₦)").fill("1500");
  await page.getByLabel("Opening stock quantity").fill("4");
  await page.getByRole("button", { name: "Save option" }).click();
  await page.locator("[data-variant-feedback]", { hasText: "Option added." }).waitFor();
  eq(
    await db.prepare("SELECT stock FROM variants WHERE sku='FX-ED-2'").first("stock"),
    4,
    "Option stored with opening stock",
  );
  ok(true, "Option success confirmed");

  // Double tap on a new product creates exactly one product.
  await page.getByRole("button", { name: "Back to products" }).click();
  await openAdminSection(page, "Overview");
  await page
    .getByRole("navigation", { name: "Quick actions" })
    .getByRole("button", { name: "Add product" })
    .click();
  await page.getByRole("heading", { name: "New product" }).waitFor();
  await page.getByLabel("Product name").fill("Fixture Double Tap");
  await page.locator('select[name="category"]').selectOption("clothing");
  let posts = 0;
  await page.route("**/api/admin/products", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await new Promise((r) => setTimeout(r, 400)); // a slow phone network
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save product" }).evaluate((b) => {
    b.click();
    b.click();
  });
  await page.locator("[data-product-saved]").waitFor();
  eq(posts, 1, "One save request for a double tap");
  eq(
    await db.prepare("SELECT COUNT(*) n FROM products WHERE name='Fixture Double Tap'").first("n"),
    1,
    "Exactly one product created",
  );
  ok(
    (await page.locator("[data-product-saved]").innerText()).includes("Add its prices"),
    "New product points to the next step",
  );
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "No horizontal overflow at 390 px",
  );
  await page.close();
  console.log(`PASS: ${checks} admin editor feedback, photo order and duplicate-submit checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
