import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createTestApp, ORIGIN } from "./harness.mjs";
const expected = "d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1";
const asset = "/brand/IMG_8842(1).png";
const absolute = "https://afnancollectionkn.com" + asset;
const original = await readFile("public" + asset);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(digest(original), expected);
assert.equal(original.readUInt32BE(16), 460);
assert.equal(original.readUInt32BE(20), 546);
const manifest = JSON.parse(await readFile("docs/design/AFNAN-BRAND-ASSET.json", "utf8"));
assert.equal(manifest.original.checksumVerified, true);
assert.equal(manifest.original.expectedSha256, expected);
assert.equal(manifest.integration.status, "integrated-original-png");
const { mf } = await createTestApp({ port: 8787 });
const browser = await chromium.launch();
let checks = 6;
try {
  const served = await mf.dispatchFetch(ORIGIN + asset);
  assert.equal(served.status, 200);
  assert.equal(digest(Buffer.from(await served.arrayBuffer())), expected);
  checks += 2;
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    if (width === 768)
      await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await page.goto(ORIGIN + "/");
    const logos = page.locator('img[data-brand-logo="original"]');
    assert.equal(await logos.count(), 2);
    checks++;
    for (const logo of await logos.all()) {
      await logo.evaluate((img) => img.decode());
      const data = await logo.evaluate((img) => ({
        src: img.getAttribute("src"),
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: img.getBoundingClientRect().width,
        height: img.getBoundingClientRect().height,
      }));
      assert.equal(data.src, asset);
      assert.equal(data.alt, "Afnan Collection");
      assert.equal(data.naturalWidth, 460);
      assert.equal(data.naturalHeight, 546);
      assert.ok(
        Math.abs(data.width / data.height - 460 / 546) < 0.002,
        "Logo aspect ratio changed",
      );
      assert.ok(data.width <= 460, "Do not upscale original artwork");
      checks += 6;
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `Logo/header overflow at ${width}`,
    );
    checks++;
    assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"), asset);
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute("content"), absolute);
    assert.equal(
      await page.locator('meta[name="twitter:image"]').getAttribute("content"),
      absolute,
    );
    const data = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent)));
    assert.equal(data.find((x) => x["@type"] === "Store").logo, absolute);
    checks += 4;
    assert.equal(await page.locator('img[src*="traced.svg"]').count(), 0);
    checks++;
    if (process.env.BRANDING_SCREENSHOTS) {
      await mkdir(process.env.BRANDING_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: `${process.env.BRANDING_SCREENSHOTS}/afnan-original-logo-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto(ORIGIN + "/product/fixture-romper");
    assert.equal(
      await page.locator('meta[property="og:image"]').count(),
      0,
      "Homepage brand preview must not override product previews",
    );
    checks++;
    await page.close();
  }
  console.log(
    `PASS: ${checks} original-logo checksum, delivery, metadata and responsive branding assertions at 320/390/768/1440 px`,
  );
} finally {
  await browser.close();
  await mf.dispose();
}
