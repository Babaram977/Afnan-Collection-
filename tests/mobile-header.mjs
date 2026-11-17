// Real rendered geometry and navigation regressions; baseline mode records the pre-change UI.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTestApp, ORIGIN } from "./harness.mjs";
const baseline = process.argv.includes("--baseline");
const phase = baseline ? "before" : "after";
const output = process.env.HEADER_REVIEW_DIR || "/tmp/afnan-header-review";
await mkdir(output, { recursive: true });
const { mf } = await createTestApp({
  port: 8787,
  bindings: { CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
const engine = process.env.HEADER_BROWSER === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const measurements = [];
let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks++;
};
try {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [393, 852],
    [430, 932],
    [844, 390],
    [768, 1024],
    [1023, 900],
    [1024, 900],
    [1440, 1000],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/shop`);
    const card = page.locator('a[href^="/product/"]').first();
    await card.waitFor();
    const logo = page.locator('header img[data-brand-logo="original"]');
    await logo.evaluate((img) => img.decode());
    const geometry = await page.evaluate(() => {
      const header = document.querySelector("header");
      const logo = header.querySelector('img[data-brand-logo="original"]');
      const link = logo.closest("a");
      const card = document.querySelector('a[href^="/product/"]');
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
      };
      return {
        header: box(header),
        logo: box(logo),
        logoLink: box(link),
        firstProduct: box(card),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    measurements.push({ width, height, ...geometry });
    check(geometry.scrollWidth <= width, `No horizontal overflow at ${width}`);
    check(
      Math.abs(geometry.logo.width / geometry.logo.height - 460 / 546) < 0.002,
      `Original logo proportions at ${width}`,
    );
    check(geometry.logo.width === 112, `Readable logo width unchanged at ${width}`);
    if (!baseline && width < 1024) {
      check(geometry.header.height === 88, `88px mobile header at ${width}`);
      // All source artwork (y=120..426) remains inside the visible link, including padding.
      const artworkTop = geometry.logo.y + (120 * geometry.logo.height) / 546;
      const artworkBottom = geometry.logo.y + (426 * geometry.logo.height) / 546;
      check(
        artworkTop >= geometry.logoLink.y && artworkBottom <= geometry.logoLink.bottom,
        `No artwork clipped at ${width}`,
      );
      if (height >= 568)
        check(geometry.firstProduct.y < height - 40, `First product prominent at ${width}`);
    }
    if (width >= 1024)
      check(geometry.header.height === 145, `Desktop header unchanged at ${width}`);
    for (const control of [
      page.getByRole("link", { name: /^Cart, / }),
      ...(width < 1024 ? [page.getByRole("button", { name: "Open menu" })] : []),
    ]) {
      const b = await control.boundingBox();
      check(b.width >= 44 && b.height >= 44, `44px control targets at ${width}`);
    }
    if (width < 1024) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const nav = page.getByRole("navigation", { name: "Mobile", exact: true });
      await nav.waitFor();
      for (const name of ["Account", "Shop", "About", "Contact", "Policies", "Cart"])
        check(
          await nav.getByRole("link", { name, exact: true }).isVisible(),
          `${name} accessible at ${width}`,
        );
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      check((await page.getByRole("dialog").count()) === 0, `Menu closes by keyboard at ${width}`);
      await page.getByRole("button", { name: "Open menu" }).click();
      await nav.getByRole("link", { name: "About", exact: true }).click();
      await page.waitForURL("**/about");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      check(
        (await page.getByRole("dialog").count()) === 0,
        `Menu closes after navigation at ${width}`,
      );
      await page.goto(`${ORIGIN}/shop`);
    } else
      check(
        await page.getByRole("navigation", { name: "Main", exact: true }).isVisible(),
        `Desktop navigation unchanged at ${width}`,
      );
    await page.getByRole("link", { name: /^Cart, / }).click();
    await page.waitForURL("**/cart");
    check(new URL(page.url()).pathname === "/cart", `Cart navigation at ${width}`);
    await page.goto(`${ORIGIN}/shop`);
    const axe = await new AxeBuilder({ page })
      .include("header")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(axe.violations, [], `Header accessibility at ${width}`);
    checks++;
    if ([375, 390, 430, 1440].includes(width))
      await page.screenshot({ path: `${output}/${phase}-shop-${width}.png` });
    if (width === 390) {
      await page.goto(`${ORIGIN}/`);
      await page.screenshot({ path: `${output}/${phase}-home-${width}.png` });
    }
    await page.goto(`${ORIGIN}/admin`);
    check(
      (await page.locator("header").first().boundingBox()).height === 65,
      `Admin header remains 65px at ${width}`,
    );
    await context.close();
  }
  await writeFile(
    `${output}/${phase}-measurements.json`,
    JSON.stringify({ phase, checks, measurements }, null, 2) + "\n",
  );
  console.log(
    `PASS: ${checks} ${phase} mobile-header geometry, navigation, touch target and accessibility checks`,
  );
  console.log(
    JSON.stringify(
      measurements.map((m) => ({
        width: m.width,
        height: m.height,
        header: m.header.height,
        logoWidth: m.logo.width,
        firstProductTop: m.firstProduct.y,
      })),
    ),
  );
} finally {
  await browser.close();
  await mf.dispose();
}
