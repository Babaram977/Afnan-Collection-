// Storefront cart flow with checkout disabled (2026-11-17 owner report): after "Add to cart" the
// customer gets clear "View cart" / "Continue shopping" actions; size/colour can be chosen (listed
// colours on one variant, or separate size/colour variants); choices and an optional note travel
// with the cart line; the cart explains that checkout is temporarily unavailable.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN } from "./harness.mjs";

const { mf, db } = await createTestApp({
  port: 8787,
  bindings: { APP_ENV: "acceptance", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
const ids = {
  jeans: "aaaaaaaa-0000-4000-8000-000000000001",
  shirt: "aaaaaaaa-0000-4000-8000-000000000002",
  sRed: "bbbbbbbb-0000-4000-8000-000000000001",
  sGreen: "bbbbbbbb-0000-4000-8000-000000000002",
  mRed: "bbbbbbbb-0000-4000-8000-000000000003",
};
let checks = 0;
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const eq = (a, b, m) => {
  assert.equal(a, b, m);
  checks++;
};
const browser = await chromium.launch();
try {
  await db.batch([
    db.prepare(
      "INSERT INTO products(id,slug,name,category,status) VALUES('cj','fixture-jeans','Fixture Jeans','clothing','active'),('cs','fixture-shirt','Fixture Shirt','clothing','active')",
    ),
    // Shaped like the owner's real entry: one variant, a size range and listed colours.
    db
      .prepare(
        "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,stock) VALUES(?,'cj','FX-J','2-10 years','Blue, Black, Ash',800000,25)",
      )
      .bind(ids.jeans),
    // Separate size/colour variants; M/Green does not exist.
    db
      .prepare(
        "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,stock) VALUES(?,'cs','FX-S-R','S','Red',500000,5),(?,'cs','FX-S-G','S','Green',500000,5),(?,'cs','FX-M-R','M','Red',550000,5)",
      )
      .bind(ids.sRed, ids.sGreen, ids.mRed),
  ]);

  // Server cart: notes accepted, identical lines refused, oversized notes refused.
  const api = new Client(mf);
  await api.request("/me");
  eq(
    (
      await api.request("/cart", "PUT", [
        { variantId: ids.jeans, qty: 1, note: "Colour: Black" },
        { variantId: ids.jeans, qty: 1, note: "Colour: Blue" },
      ])
    ).status,
    200,
    "Same variant with different choices is two lines",
  );
  eq(
    (
      await api.request("/cart", "PUT", [
        { variantId: ids.jeans, qty: 1, note: "x" },
        { variantId: ids.jeans, qty: 2, note: "x" },
      ])
    ).status,
    400,
    "Duplicate line refused",
  );
  eq(
    (await api.request("/cart", "PUT", [{ variantId: ids.jeans, qty: 1, note: "x".repeat(201) }]))
      .status,
    400,
    "Oversized note refused",
  );

  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      extraHTTPHeaders: { "CF-Connecting-IP": `198.51.100.${width === 390 ? 40 : 41}` },
    });
    const badge = () =>
      page.getByRole("link", { name: /^Cart, \d+ items?$/ }).getAttribute("aria-label");
    const noOverflow = async (where) =>
      ok(
        !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
        `No horizontal overflow: ${where} ${width}`,
      );

    // Listed colours on one variant: a choice is required; size range is shown as text.
    await page.goto(`${ORIGIN}/product/fixture-jeans`);
    const addBtn = page.locator("button", { hasText: /Choose a colour|Add to cart/ });
    await addBtn.waitFor();
    eq(await addBtn.innerText(), "Choose a colour", `Colour required at ${width}`);
    ok(await addBtn.isDisabled(), "Cannot add before choosing");
    ok(await page.getByText("2-10 years").isVisible(), "Size range shown");
    await page.getByRole("button", { name: "Black", exact: true }).click();
    await page.getByLabel("Note for this item (optional)").fill("age 6");
    eq(await addBtn.innerText(), "Add to cart");
    await addBtn.click();
    const added = page.locator("[data-added-to-cart]");
    await added.waitFor();
    ok(
      (await added.innerText()).includes("Colour: Black · Note: age 6"),
      "Confirmation names choice",
    );
    ok(await added.getByRole("link", { name: "View cart" }).isVisible(), "View cart action");
    ok(await added.getByRole("link", { name: "Continue shopping" }).isVisible(), "Continue action");
    await page.waitForFunction(() => document.querySelector('a[aria-label^="Cart, 1 item"]'));
    await noOverflow("product");

    await page.getByRole("button", { name: "Blue", exact: true }).click();
    ok(!(await added.isVisible()), "Confirmation clears when the choice changes");
    await page.getByLabel("Note for this item (optional)").fill("");
    await addBtn.click();
    await page.waitForFunction(() => document.querySelector('a[aria-label^="Cart, 2 items"]'));
    ok(true, "Second colour adds a second line");

    // Continue shopping keeps the cart.
    await page
      .locator("[data-added-to-cart]")
      .getByRole("link", { name: "Continue shopping" })
      .click();
    await page.waitForURL(/\/shop/);
    eq(await badge(), "Cart, 2 items", "Cart kept after continuing to shop");

    // Separate size/colour variants: groups pick the variant; missing combinations disabled.
    await page.goto(`${ORIGIN}/product/fixture-shirt`);
    await page.getByRole("group", { name: /^Size/ }).waitFor();
    await page.getByRole("button", { name: "M", exact: true }).click();
    ok(
      await page.getByRole("button", { name: "Green", exact: true }).isDisabled(),
      "M/Green does not exist",
    );
    ok(await page.getByText("₦5,500").first().isVisible(), "M price shown");
    await page.getByRole("button", { name: "S", exact: true }).click();
    await page.getByRole("button", { name: "Green", exact: true }).click();
    ok(await page.getByText("SKU: FX-S-G").isVisible(), "S/Green variant selected");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.locator("[data-added-to-cart]").getByRole("link", { name: "View cart" }).click();

    // Cart page: lines, notes, images, quantities, subtotal, checkout unavailable.
    await page.waitForURL(/\/cart/);
    const items = page.locator("main li");
    await items.first().waitFor();
    eq(await items.count(), 3, "Three cart lines");
    const notes = await page.locator("[data-cart-note]").allInnerTexts();
    ok(
      notes.includes("Colour: Black · Note: age 6") && notes.includes("Colour: Blue"),
      "Notes shown",
    );
    ok(await page.getByText("S · Green").isVisible(), "Variant label shown");
    ok(
      !(await page.locator("main").innerText()).includes("Blue, Black, Ash"),
      "Cart shows the chosen colour, not the whole list",
    );
    ok(await page.getByText("2-10 years", { exact: true }).first().isVisible(), "Size range kept");
    eq(
      (await page.locator("main li img, main li [role=img], main li svg").count()) >= 3,
      true,
      "Images or placeholders",
    );
    await page.getByRole("button", { name: "Increase Fixture Shirt" }).click();
    await page.getByText("₦26,000").waitFor();
    ok(true, "Subtotal updates (8,000 + 8,000 + 2 × 5,000)");
    await page.getByRole("button", { name: "Remove Fixture Jeans" }).first().click();
    await page.waitForFunction(() => document.querySelectorAll("main li").length === 2);
    ok(true, "Remove one line");
    const notice = page.locator("[data-checkout-unavailable]");
    await page.getByText("temporarily unavailable").waitFor();
    ok(
      (await notice.innerText()).includes("temporarily unavailable"),
      "Checkout unavailable notice",
    );
    ok(
      await page.getByRole("button", { name: "Checkout coming soon" }).isDisabled(),
      "No checkout",
    );
    eq(
      await page.getByRole("link", { name: "Continue to checkout" }).count(),
      0,
      "No checkout link",
    );
    ok(
      await page.getByRole("link", { name: "Continue shopping" }).isVisible(),
      "Continue shopping in cart",
    );
    await noOverflow("cart");

    // Reload: lines and notes persist.
    await page.reload();
    await page.locator("[data-cart-note]").first().waitFor();
    eq(await page.locator("main li").count(), 2, "Cart persists after reload");
    await page.close();
  }
  console.log(`PASS: ${checks} cart navigation, option choice, note and checkout-disabled checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
