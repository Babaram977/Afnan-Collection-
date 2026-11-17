// Customer shopping experience (2026-11-17): in-stock default option, distinguishable duplicate
// options, sold-out/low-stock/sale signals on cards and product pages, and a phone shop page where
// products appear on the first screen with filters behind a "Filters" button.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN } from "./harness.mjs";

const { mf, db } = await createTestApp({
  port: 8787,
  bindings: { APP_ENV: "acceptance", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
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
      "INSERT INTO products(id,slug,name,category,status) VALUES('dup','fx-dup','Fixture Duplicate Gown','clothing','active'),('so','fx-soldout','Fixture Sold Out','shoes','active'),('few','fx-few','Fixture Few Left','toys','active'),('sale','fx-sale','Fixture On Sale','clothing','active')",
    ),
    // Shaped like the owner's Mikeni gown: two options with identical labels, the first sold out.
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,stock) VALUES('aaaaaaaa-1111-4000-8000-000000000001','dup','FX-D-1','4-8','Blue, Red',2600000,0),('aaaaaaaa-1111-4000-8000-000000000002','dup','FX-D-2','4-8','Blue, Red',2600000,10)",
    ),
    db.prepare(
      "INSERT INTO products(id,slug,name,category,status) VALUES('grid','fx-grid','Fixture Grid Shirt','clothing','active')",
    ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,size,color,price_kobo,stock) VALUES('aaaaaaaa-1111-4000-8000-000000000006','grid','FX-G-SR','S','Red',500000,5),('aaaaaaaa-1111-4000-8000-000000000007','grid','FX-G-SG','S','Green',500000,5),('aaaaaaaa-1111-4000-8000-000000000008','grid','FX-G-MR','M','Red',500000,5)",
    ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('aaaaaaaa-1111-4000-8000-000000000003','so','FX-SO',500000,0),('aaaaaaaa-1111-4000-8000-000000000004','few','FX-FEW',300000,2)",
    ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,sale_price_kobo,stock) VALUES('aaaaaaaa-1111-4000-8000-000000000005','sale','FX-SALE',1000000,800000,20)",
    ),
  ]);

  // Product page: duplicate options.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${ORIGIN}/product/fx-dup`);
  const status = page.locator("[data-stock-status]");
  await status.waitFor();
  eq(await status.innerText(), "In stock (10 available)", "Opens on the in-stock option");
  const one = page.getByRole("button", {
    name: "4-8 · Blue, Red (option 1) (sold out)",
    exact: true,
  });
  const two = page.getByRole("button", { name: "4-8 · Blue, Red (option 2)", exact: true });
  ok(await one.isVisible(), "Duplicate labels numbered; sold-out announced");
  eq(await two.getAttribute("aria-pressed"), "true", "In-stock option selected");
  eq(await one.getAttribute("aria-pressed"), "false", "Only one option looks selected");
  await one.click();
  eq(await status.innerText(), "Sold out");
  ok(
    await page.getByRole("button", { name: "Sold out", exact: true }).isDisabled(),
    "Cannot add sold out",
  );
  await two.click();
  eq(
    await page.locator("button", { hasText: "Choose a colour" }).count(),
    1,
    "Listed colours still required",
  );
  await page.getByRole("button", { name: "Red", exact: true }).click();
  ok(await page.getByRole("button", { name: "Add to cart" }).isEnabled(), "Can add after choosing");
  // A missing size/colour combination is disabled but not announced as sold out.
  await page.goto(`${ORIGIN}/product/fx-grid`);
  await page.getByRole("button", { name: "M", exact: true }).click();
  const green = page.getByRole("button", { name: "Green", exact: true });
  ok(await green.isDisabled(), "Missing combination disabled");
  eq(
    await page.getByRole("button", { name: "Green (sold out)" }).count(),
    0,
    "Not called sold out",
  );
  await page.goto(`${ORIGIN}/product/fx-few`);
  eq(await page.locator("[data-stock-status]").innerText(), "Only 2 left", "Low stock wording");

  // Cards: badges and sale price.
  await page.goto(`${ORIGIN}/shop`);
  const card = (name) => page.locator("a[href^='/product/']", { hasText: name });
  await card("Fixture Sold Out").waitFor();
  eq(await card("Fixture Sold Out").locator("[data-card-badge]").innerText(), "Sold out");
  eq(await card("Fixture Few Left").locator("[data-card-badge]").innerText(), "Only 2 left");
  eq(await card("Fixture On Sale").locator("[data-card-badge]").innerText(), "Sale");
  eq(
    await card("Fixture On Sale").locator("del").innerText(),
    "₦10,000",
    "Regular price struck through",
  );
  eq(
    await card("Fixture Duplicate Gown").locator("[data-card-badge]").count(),
    0,
    "No badge when in stock",
  );
  await page.close();

  // Shop layout per width.
  for (const width of [320, 390, 1440]) {
    const p = await browser.newPage({ viewport: { width, height: 844 } });
    await p.goto(`${ORIGIN}/shop`);
    const first = p.locator("a[href^='/product/']").first();
    await first.waitFor();
    const filters = p.getByRole("button", { name: /^(Filters|Hide filters)/ });
    if (width < 1024) {
      ok((await first.boundingBox()).y < 844, `First product on the first screen at ${width}`);
      eq(await filters.getAttribute("aria-expanded"), "false", "Filters start collapsed");
      ok(!(await p.locator("#shop-filters").isVisible()), "Filter panel hidden");
      ok(await p.getByLabel("Search", { exact: true }).isVisible(), "Search stays visible");
      const chips = p.getByRole("group", { name: "Shop by category" }).getByRole("button");
      const labels = await chips.allInnerTexts();
      ok(
        labels[0] === "All" && labels.includes("Clothing") && labels.includes("Toys & Learning"),
        "Category chips",
      );
      ok(!labels.includes("Books"), "Only categories that have products");
      await chips.filter({ hasText: "Toys" }).click();
      await p.waitForURL(/category=toys/);
      eq(await p.locator("a[href^='/product/']").count(), 1, "Chip filters the grid");
      eq(await chips.filter({ hasText: "Toys" }).getAttribute("aria-pressed"), "true");
      await filters.click();
      eq(await filters.getAttribute("aria-expanded"), "true");
      ok(await p.getByLabel("Category", { exact: true }).isVisible(), "Panel opens");
      ok((await filters.innerText()).includes("1"), "Active filter count shown");
    } else {
      ok(!(await filters.isVisible()), "Desktop has no Filters button");
      ok(await p.getByLabel("Category", { exact: true }).isVisible(), "Desktop sidebar unchanged");
      ok(
        !(await p.getByRole("group", { name: "Shop by category" }).isVisible()),
        "Chips are phone-only",
      );
    }
    ok(
      !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
      `No horizontal overflow at ${width}`,
    );
    await p.close();
  }
  console.log(
    `PASS: ${checks} shopping experience checks (options, stock signals, mobile shop layout)`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
