import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN } from "./harness.mjs";

// Fictional local fixtures only. No remote storage, real email or payment calls.
const { mf, db, productId } = await createTestApp({
  port: 8787,
  bindings: { CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
const browser = await chromium.launch();
let checks = 0;
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZOKAAAAAASUVORK5CYII=",
  "base64",
);
try {
  const bucket = await mf.getR2Bucket("MEDIA");
  const images = [];
  for (let i = 0; i < 8; i++) {
    const key = randomUUID() + ".png";
    await bucket.put(key, png, { httpMetadata: { contentType: "image/png" } });
    images.push({ url: "/media/" + key, alt: `Test fixture photo ${i + 1}` });
  }
  await db
    .prepare("UPDATE products SET images=? WHERE id=?")
    .bind(JSON.stringify(images), productId)
    .run();
  const optionProduct = randomUUID();
  const longProduct = randomUUID();
  const draftProduct = randomUUID();
  const longName = "Test fixture " + "X".repeat(90);
  await db.prepare("INSERT INTO categories VALUES('test-outfits','Test outfits')").run();
  for (const [id, slug, name, category, status, age] of [
    [optionProduct, "fixture-options", "Test fixture options", "test-outfits", "active", "kids"],
    [longProduct, "fixture-long-name", longName, "shoes", "active", "toddler"],
    [draftProduct, "fixture-hidden", "Test fixture hidden draft", "clothing", "draft", "baby"],
  ]) {
    await db
      .prepare("INSERT INTO products(id,slug,name,category,status,age_groups) VALUES(?,?,?,?,?,?)")
      .bind(id, slug, name, category, status, JSON.stringify([age]))
      .run();
  }
  for (const [product, sku, size, color, price, sale, stock] of [
    [optionProduct, "FIXTURE-S-RED", "S", "Red", 125000, 100050, 2],
    [optionProduct, "FIXTURE-L-BLUE", "L", "Blue", 350000, null, 0],
    [longProduct, "FIXTURE-LONG", "One size", "", 800000, null, 3],
  ]) {
    await db
      .prepare(
        "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,sale_price_kobo,stock) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(randomUUID(), product, sku, size, color, price, sale, stock)
      .run();
  }
  for (const width of [320, 390, 768, 1440]) {
    await db.prepare("DELETE FROM rate_limits").run();
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (width === 768)
      await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    const noOverflow = async (label) =>
      equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${label} overflow at ${width}`,
      );
    const cards = () => page.locator('section[aria-label="Results"] h3');
    const clearFilters = async () => {
      await page.getByRole("link", { name: "Clear filters", exact: true }).first().click();
      await expect(page).toHaveURL(ORIGIN + "/shop");
      await expect(cards()).toHaveCount(3);
    };
    await page.goto(ORIGIN + "/shop");
    await expect(cards()).toHaveCount(3);
    checks++;
    equal(await page.getByText("Test fixture hidden draft", { exact: true }).count(), 0);
    await noOverflow("Shop long product name");
    await page.goto(ORIGIN + "/");
    await page.getByRole("link", { name: "Test outfits", exact: true }).click();
    await expect(cards()).toHaveText(["Test fixture options"]);
    checks++;
    equal(await page.getByLabel("Category", { exact: true }).inputValue(), "test-outfits");
    await clearFilters();
    await page.getByLabel("Category", { exact: true }).selectOption("test-outfits");
    await expect(cards()).toHaveText(["Test fixture options"]);
    checks++;
    await clearFilters();
    await page.getByLabel("Age", { exact: true }).selectOption("baby");
    await expect(cards()).toHaveText(["Test fixture romper"]);
    checks++;
    await clearFilters();
    await page.getByLabel("Size", { exact: true }).selectOption("S");
    await expect(cards()).toHaveText(["Test fixture options"]);
    checks++;
    await clearFilters();
    await page.getByLabel("Minimum price in naira").fill("3000");
    await page.getByLabel("Maximum price in naira").fill("4000");
    await expect(cards()).toHaveText(["Test fixture options"]);
    checks++;
    await clearFilters();
    equal(await page.getByLabel("Minimum price in naira").inputValue(), "");
    equal(await page.getByLabel("Maximum price in naira").inputValue(), "");
    await page.getByLabel("Search", { exact: true }).fill("does-not-exist");
    await expect(page.getByRole("heading", { name: "No matches" })).toBeVisible();
    checks++;
    await clearFilters();
    equal(await page.getByLabel("Search", { exact: true }).inputValue(), "");
    await page.getByLabel("Sort by").selectOption("low");
    await expect(cards()).toHaveText(["Test fixture options", "Test fixture romper", longName]);
    checks++;
    await page.getByLabel("Sort by").selectOption("high");
    await expect(cards()).toHaveText([longName, "Test fixture romper", "Test fixture options"]);
    checks++;

    await page.goto(ORIGIN + "/product/fixture-romper");
    await expect(page.getByText("Option: M", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("button", { name: "Show image 8", exact: true }).click();
    const mainImage = page.locator('#main img[alt="Test fixture photo 8"]');
    await mainImage.evaluate((img) => img.decode());
    equal(await mainImage.getAttribute("src"), images[7].url);
    const thumbnails = page.getByRole("list", { name: "Gallery" }).locator("img");
    equal(await thumbnails.count(), 8);
    for (const image of await thumbnails.all()) await image.evaluate((img) => img.decode());
    equal(await thumbnails.evaluateAll((imgs) => imgs.every((img) => img.naturalWidth > 0)), true);
    await noOverflow("Eight-image gallery");
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto(ORIGIN + "/product/fixture-options");
    await expect(page.getByText("Test outfits", { exact: true })).toBeVisible();
    checks++;
    await expect(page.getByText("₦1,000.5", { exact: true })).toBeVisible();
    checks++;
    await expect(page.locator("del")).toHaveText("₦1,250");
    checks++;
    await page.getByRole("button", { name: "L · Blue", exact: true }).click();
    await expect(page.getByText("₦3,500", { exact: true })).toBeVisible();
    checks++;
    await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeDisabled();
    checks++;
    await page.getByRole("button", { name: "S · Red", exact: true }).click();
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto(ORIGIN + "/product/fixture-long-name");
    await noOverflow("Product long name");
    await expect(page.getByText("Photo coming soon", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto(ORIGIN + "/cart");
    await expect(page.getByText(longName, { exact: true })).toBeVisible();
    checks++;
    await noOverflow("Cart long name");
    await expect(page.getByText("₦11,500.5", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("button", { name: "Increase Test fixture options", exact: true }).click();
    await expect(page.getByText("₦12,501", { exact: true })).toBeVisible();
    checks++;
    await page.reload();
    await expect(page.getByText("₦12,501", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("button", { name: `Remove ${longName}`, exact: true }).click();
    await expect(page.getByText("₦4,501", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("button", { name: "Decrease Test fixture options", exact: true }).click();
    await expect(page.getByText("₦3,500.5", { exact: true })).toBeVisible();
    checks++;
    await page.getByRole("link", { name: "Continue to checkout", exact: true }).click();
    await expect(
      page.getByText("Ordering is not enabled. No real orders or payments can be submitted."),
    ).toBeVisible();
    checks++;
    await expect(page.getByRole("button", { name: "Prepare order", exact: true })).toBeDisabled();
    checks++;
    if (width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("navigation", { name: "Mobile", exact: true })
        .getByRole("link", { name: "Shop", exact: true })
        .click();
      await expect(page).toHaveURL(ORIGIN + "/shop");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      checks++;
    }
    for (const path of ["/shop", "/product/fixture-romper", "/cart"]) {
      await page.goto(ORIGIN + path);
      await noOverflow(path);
      const axe = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      equal(
        axe.violations.map((v) => v.id),
        [],
        `Accessibility ${path} at ${width}`,
      );
      if (process.env.STOREFRONT_SCREENSHOTS) {
        await mkdir(process.env.STOREFRONT_SCREENSHOTS, { recursive: true });
        await page.screenshot({
          path: `${process.env.STOREFRONT_SCREENSHOTS}/${path.split("/").filter(Boolean).join("-")}-${width}.png`,
          fullPage: true,
        });
      }
    }
    equal(errors, [], `Browser errors at ${width}`);
    await context.close();
  }
  const emptyPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await db.prepare("DELETE FROM rate_limits").run();
  const unavailable = await emptyPage.goto(ORIGIN + "/product/fixture-hidden");
  equal(unavailable.status(), 404);
  await expect(
    emptyPage.getByRole("heading", { name: "Product not found", exact: true }),
  ).toBeVisible();
  checks++;
  await db.prepare("UPDATE products SET status='draft'").run();
  await emptyPage.goto(ORIGIN + "/shop");
  await expect(
    emptyPage.getByRole("heading", { name: "No products yet", exact: true }),
  ).toBeVisible();
  checks++;
  equal(await emptyPage.locator('section[aria-label="Results"] h3').count(), 0);
  await emptyPage.close();
  equal(await db.prepare("SELECT COUNT(*) AS n FROM orders").first("n"), 0);
  equal(await db.prepare("SELECT COUNT(*) AS n FROM payments").first("n"), 0);
  console.log(
    `PASS: ${checks} storefront filter, gallery, option, NGN cart, responsive/accessibility and disabled-checkout checks at 320/390/768/1440 px`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
