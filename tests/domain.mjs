// Primary-domain routing: www.<primary host> redirects permanently to the primary origin with the
// same path and query; the primary host itself is served normally.
import assert from "node:assert/strict";
import { createTestApp, ORIGIN } from "./harness.mjs";

const { mf } = await createTestApp({
  bindings: { APP_ENV: "acceptance", CHECKOUT_ENABLED: "false", PAYMENT_MODE: "disabled" },
});
let checks = 0;
try {
  const www = ORIGIN.replace("://", "://www.");
  for (const path of ["/", "/shop?category=shoes", "/api/health", "/admin"]) {
    const res = await mf.dispatchFetch(www + path, { redirect: "manual" });
    assert.equal(res.status, 301, `www ${path} redirects`);
    assert.equal(res.headers.get("location"), ORIGIN + path, `same path/query for ${path}`);
    checks += 2;
  }
  const apex = await mf.dispatchFetch(ORIGIN + "/", { redirect: "manual" });
  assert.equal(apex.status, 200, "Primary host is served");
  const other = await mf.dispatchFetch(ORIGIN.replace("://", "://shop.") + "/", {
    redirect: "manual",
  });
  assert.notEqual(other.status, 301, "Only www redirects");
  checks += 2;
  console.log(`PASS: ${checks} primary-domain routing assertions (www redirect, apex served)`);
} finally {
  await mf.dispose();
}
