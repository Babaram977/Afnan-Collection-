// Storefront photo weight (2026-11-21 audit: product cards downloaded the full photographs, 0.6-2.5
// MB each, to show them at ~200 px). New uploads store a small card copy beside the photograph;
// cards, the bag and gallery buttons use it, older photos without one keep working, the product
// page's main photo loads first, and returning visitors revalidate with a 304.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const PNG = await readFile("public/brand/afnan-collection-logo.png");
const KEY = {
  full: "44444444-4444-4444-8444-444444444444.png",
  thumb: "55555555-5555-4555-8555-555555555555.webp",
  legacy: "66666666-6666-4666-8666-666666666666.png",
};
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
  assert.equal(a, b, m);
  checks++;
};
const ok = (v, m) => {
  assert.ok(v, m);
  checks++;
};
const browser = await chromium.launch();
try {
  const media = await mf.getR2Bucket("MEDIA");
  for (const key of Object.values(KEY))
    await media.put(key, PNG, { httpMetadata: { contentType: "image/png" } });
  await db.batch([
    db
      .prepare(
        "INSERT INTO products(id,slug,name,category,status,images) VALUES('t1','fx-thumb','Fixture Thumb','clothing','active',?),('77777777-7777-4777-8777-777777777777','fx-legacy','Fixture Legacy','clothing','active',?)",
      )
      .bind(
        JSON.stringify([
          { url: `/media/${KEY.full}`, thumb: `/media/${KEY.thumb}`, alt: "Thumb photo" },
          { url: `/media/${KEY.legacy}`, alt: "Second photo" },
        ]),
        JSON.stringify([{ url: `/media/${KEY.legacy}`, alt: "Legacy photo" }]),
      ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('vt1','t1','FX-T-1',100000,5),('vt2','77777777-7777-4777-8777-777777777777','FX-T-2',100000,5)",
    ),
  ]);

  // Public route: the card copy follows its product's visibility, exactly like the photograph.
  const thumb = await mf.dispatchFetch(`${ORIGIN}/media/${KEY.thumb}`);
  eq(thumb.status, 200, "Card copy of a published product is public");
  const etag = thumb.headers.get("etag");
  ok(etag, "Photo responses carry an ETag");
  eq(thumb.headers.get("cache-control"), "public,max-age=3600", "Cache lifetime unchanged");
  const again = await mf.dispatchFetch(`${ORIGIN}/media/${KEY.thumb}`, {
    headers: { "If-None-Match": etag },
  });
  eq(again.status, 304, "Unchanged photo revalidates with 304");
  eq((await again.arrayBuffer()).byteLength, 0, "304 sends no photo bytes");
  eq(
    (
      await mf.dispatchFetch(`${ORIGIN}/media/${KEY.thumb}`, {
        headers: { "If-None-Match": '"x"' },
      })
    ).status,
    200,
    "A stale ETag gets the photo",
  );
  await db.prepare("UPDATE products SET status='draft' WHERE id='t1'").run();
  eq((await mf.dispatchFetch(`${ORIGIN}/media/${KEY.thumb}`)).status, 404, "Draft: copy private");
  eq((await mf.dispatchFetch(`${ORIGIN}/media/${KEY.full}`)).status, 404, "Draft: photo private");
  eq(
    (
      await mf.dispatchFetch(`${ORIGIN}/media/${KEY.thumb}`, {
        headers: { "If-None-Match": etag },
      })
    ).status,
    404,
    "A cached ETag cannot revalidate an unpublished photo",
  );
  await db.prepare("UPDATE products SET status='active' WHERE id='t1'").run();

  // Storefront: cards use the copy, older photos fall back, the main product photo is eager.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requested = new Set();
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/media/")) requested.add(u.pathname);
  });
  await page.goto(`${ORIGIN}/shop`);
  const card = (name) => page.locator("a[href^='/product/']", { hasText: name }).locator("img");
  await card("Fixture Thumb").waitFor();
  eq(await card("Fixture Thumb").getAttribute("src"), `/media/${KEY.thumb}`, "Card uses copy");
  eq(await card("Fixture Legacy").getAttribute("src"), `/media/${KEY.legacy}`, "Legacy fallback");
  eq(await card("Fixture Thumb").getAttribute("loading"), "lazy", "Cards stay lazy");
  eq(await card("Fixture Thumb").getAttribute("decoding"), "async");
  await card("Fixture Thumb").scrollIntoViewIfNeeded();
  await card("Fixture Thumb").evaluate((el) => el.decode());
  ok(!requested.has(`/media/${KEY.full}`), "Shop page never downloads the full photograph");

  await page.goto(`${ORIGIN}/product/fx-thumb`);
  const main = page.locator('img[alt="Thumb photo"]');
  await main.waitFor();
  eq(await main.getAttribute("src"), `/media/${KEY.full}`, "Product page shows the full photo");
  eq(await main.getAttribute("loading"), "eager", "Main photo is not lazy");
  eq(await main.getAttribute("fetchpriority"), "high", "Main photo is fetched first");
  const buttons = page.getByRole("list", { name: "Gallery" }).locator("img");
  eq(await buttons.nth(0).getAttribute("src"), `/media/${KEY.thumb}`, "Gallery button uses copy");
  eq(await buttons.nth(1).getAttribute("src"), `/media/${KEY.legacy}`, "Gallery fallback");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.locator("[data-added-to-cart]").getByRole("link", { name: "View cart" }).click();
  const line = page.locator('main img[alt="Fixture Thumb"]');
  await line.waitFor();
  eq(await line.getAttribute("src"), `/media/${KEY.thumb}`, "Bag uses the copy");
  await page.close();

  // Admin upload stores the photograph and a smaller card copy; a failed upload later in the same
  // selection keeps the photos that already uploaded.
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  const admin = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.60" },
  });
  await admin.goto(`${ORIGIN}/admin?setup=${token}`);
  await admin.getByLabel("New password").fill(PASSWORD);
  await admin.getByLabel("Confirm password").fill(PASSWORD);
  await admin.getByRole("button", { name: "Set password" }).click();
  await admin.getByLabel("Email").fill(EMAIL);
  await admin.getByLabel("Password").fill(PASSWORD);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  await openAdminSection(admin, "Products");
  await admin
    .locator("[data-product-list] li", { hasText: "Fixture Legacy" })
    .getByRole("button", { name: "Edit product" })
    .click();
  await admin.locator('img[alt="Legacy photo"]').waitFor();
  const uploads = [];
  await admin.route("**/api/admin/media", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    uploads.push(route.request().postDataBuffer().byteLength);
    // Fail the third photograph of the selection (fifth upload: 2 per photo).
    if (uploads.length === 5)
      return route.fulfill({ status: 500, body: '{"error":"Storage unavailable"}' });
    return route.continue();
  });
  const big = await admin.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 1800;
    const g = c.getContext("2d");
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `hsl(${i * 37} 70% 50%)`;
      g.fillRect((i * 97) % 1800, (i * 53) % 1800, 120, 120);
    }
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  const file = (n) => ({ name: `p${n}.png`, mimeType: "image/png", buffer: Buffer.from(big) });
  await admin.setInputFiles("#product-photos-upload", [file(1), file(2), file(3)]);
  await admin
    .getByRole("alert")
    .filter({ hasText: "2 of 3 photos added. The rest did not upload: Storage unavailable" })
    .waitFor();
  eq(
    await admin.locator('img[src^="/api/admin/media/"]').count(),
    3,
    "Existing photo plus the two that uploaded",
  );
  ok(uploads[1] < uploads[0] / 2, `Card copy is much smaller (${uploads[1]} vs ${uploads[0]} B)`);
  await admin.getByRole("button", { name: "Save product" }).click();
  await admin.getByRole("button", { name: "Save product" }).waitFor();
  let images = [];
  for (let i = 0; i < 50 && images.length !== 3; i++) {
    images = JSON.parse(
      await db
        .prepare("SELECT images FROM products WHERE id='77777777-7777-4777-8777-777777777777'")
        .first("images"),
    );
    if (images.length !== 3) await new Promise((r) => setTimeout(r, 100));
  }
  eq(images.length, 3, "Saved with the two new photos");
  ok(!images[0].thumb, "Older photo saved unchanged");
  ok(
    images
      .slice(1)
      .every((im) => /^\/media\/[a-f0-9-]+\.webp$/.test(im.thumb) && im.thumb !== im.url),
    "New photos saved with their card copy",
  );
  eq((await mf.dispatchFetch(`${ORIGIN}${images[1].thumb}`)).status, 200, "Copy served publicly");
  await admin.close();
  console.log(`PASS: ${checks} storefront photo weight, revalidation and upload checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
