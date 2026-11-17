// Product photos in the admin dashboard and storefront (2026-11-17 production report: draft
// product thumbnails appeared broken). Public /media/ serves only published/active photos; the
// admin dashboard must load every photo through the authorized /api/admin/media/ route and show a
// placeholder, not a broken image, when a file is missing.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createTestApp, Client, ORIGIN, openAdminSection } from "./harness.mjs";
import { provisionPasswordAdmin } from "../scripts/admin-provision-password.mjs";

const EMAIL = "admin@afnancollectionkn.com";
const PASSWORD = "a long owner passphrase 2026";
const PNG = await readFile("public/brand/afnan-collection-logo.png");
const KEYS = {
  draft: "11111111-1111-4111-8111-111111111111.png",
  published: "22222222-2222-4222-8222-222222222222.png",
  missing: "33333333-3333-4333-8333-333333333333.png",
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
const eq = (...a) => {
  assert.equal(...a);
  checks++;
};
const ok = (...a) => {
  assert.ok(...a);
  checks++;
};
const browser = await chromium.launch();
try {
  const media = await mf.getR2Bucket("MEDIA");
  for (const key of [KEYS.draft, KEYS.published])
    await media.put(key, PNG, { httpMetadata: { contentType: "image/png" } });
  const img = (key, alt) => JSON.stringify([{ url: `/media/${key}`, alt }]);
  await db.batch([
    db
      .prepare(
        "INSERT INTO products(id,slug,name,category,status,images) VALUES('d1','draft-item','Draft Item','clothing','draft',?),('p1','published-item','Published Item','clothing','active',?),('m1','missing-photo','Missing Photo Item','clothing','draft',?)",
      )
      .bind(
        img(KEYS.draft, "Draft"),
        img(KEYS.published, "Published"),
        img(KEYS.missing, "Missing"),
      ),
    db.prepare(
      "INSERT INTO variants(id,product_id,sku,price_kobo,stock) VALUES('vd','d1','D-1',100000,5),('vp','p1','P-1',100000,5),('vm','m1','M-1',100000,5)",
    ),
  ]);

  // Public route: published photo only; drafts stay private.
  const pub = await mf.dispatchFetch(`${ORIGIN}/media/${KEYS.published}`);
  eq(pub.status, 200, "Published photo is public");
  eq(pub.headers.get("content-type"), "image/png");
  eq(
    (await mf.dispatchFetch(`${ORIGIN}/media/${KEYS.draft}`)).status,
    404,
    "Draft photo not public",
  );
  eq((await mf.dispatchFetch(`${ORIGIN}/media/not-a-key.gif`)).status, 404, "Invalid key refused");

  // Admin route: session + staff role required; correct type; never cached.
  const guest = new Client(mf);
  eq(
    (await guest.request(`/admin/media/${KEYS.draft}`)).status,
    401,
    "Admin photo needs a session",
  );
  const { statements, token } = provisionPasswordAdmin({ email: EMAIL });
  for (const s of statements) await db.prepare(s).run();
  eq((await guest.request("/admin-setup", "POST", { token, password: PASSWORD })).status, 200);
  const admin = new Client(mf);
  eq(
    (await admin.request("/auth/sign-in/email", "POST", { email: EMAIL, password: PASSWORD }))
      .status,
    200,
  );
  const draft = await admin.request(`/admin/media/${KEYS.draft}`);
  eq(draft.status, 200, "Admin can load a draft photo");
  eq(draft.headers.get("content-type"), "image/png");
  eq(draft.headers.get("cache-control"), "no-store", "Admin photos are not cached");
  eq((await admin.request(`/admin/media/${KEYS.missing}`)).status, 404, "Missing object: 404");
  eq((await admin.request("/admin/media/../secret.png")).status, 404, "Path tricks refused");
  const helper = provisionPasswordAdmin({ email: "helper@example.com" });
  for (const s of helper.statements) await db.prepare(s).run();
  await guest.request("/admin-setup", "POST", { token: helper.token, password: PASSWORD });
  await db
    .prepare(
      "DELETE FROM staff WHERE user_id=(SELECT id FROM user WHERE email='helper@example.com')",
    )
    .run();
  await db.prepare("DELETE FROM rate_limits").run();
  const nonStaff = new Client(mf);
  await nonStaff.request("/auth/sign-in/email", "POST", {
    email: "helper@example.com",
    password: PASSWORD,
  });
  eq((await nonStaff.request(`/admin/media/${KEYS.draft}`)).status, 403, "Non-staff refused");

  // Browser at iPhone width: thumbnails render for drafts and published; missing -> placeholder.
  await db.prepare("DELETE FROM rate_limits").run();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.30" },
  });
  await page.goto(`${ORIGIN}/admin`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("navigation", { name: "Administration", exact: true }).waitFor();
  await openAdminSection(page, "Products");
  const card = (name) => page.locator("[data-product-list] li", { hasText: name });
  await card("Draft Item").locator("img").waitFor();
  for (const name of ["Draft Item", "Published Item"]) {
    const thumb = card(name).locator("img");
    await thumb.evaluate((el) => el.decode());
    ok((await thumb.evaluate((el) => el.naturalWidth)) > 0, `${name} thumbnail renders`);
    ok(
      (await thumb.getAttribute("src")).startsWith("/api/admin/media/"),
      `${name} thumbnail uses the authorized route`,
    );
  }
  await card("Missing Photo Item").locator("[data-admin-image-missing]").waitFor();
  eq(
    await card("Missing Photo Item").locator("img").count(),
    0,
    "No broken image for a missing file",
  );
  const broken = await page.evaluate(
    () =>
      [...document.querySelectorAll("[data-product-list] img")].filter(
        (el) => el.complete && el.naturalWidth === 0,
      ).length,
  );
  eq(broken, 0, "No broken thumbnails on the page");

  // Editor: existing draft photo previews, and a newly uploaded photo displays immediately.
  await card("Draft Item").getByRole("button", { name: "Edit product" }).click();
  const preview = page.locator('img[alt="Draft"]');
  await preview.waitFor();
  await preview.evaluate((el) => el.decode());
  ok((await preview.evaluate((el) => el.naturalWidth)) > 0, "Editor shows the draft photo");
  await page.setInputFiles("#product-photos-upload", {
    name: "new-photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.waitForFunction(
    () => document.querySelectorAll('img[src^="/api/admin/media/"]').length >= 2,
  );
  const fresh = page.locator('img[src^="/api/admin/media/"]').nth(1);
  await fresh.evaluate((el) => el.decode());
  ok((await fresh.evaluate((el) => el.naturalWidth)) > 0, "New upload displays immediately");
  ok(
    !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)),
    "No horizontal overflow in the editor at 390 px",
  );
  console.log(`PASS: ${checks} product photo visibility, authorization and admin rendering checks`);
} finally {
  await browser.close();
  await mf.dispose();
}
