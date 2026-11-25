import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createTestApp, Client } from "./harness.mjs";

const { mf,db,zoneId }=await createTestApp({
  bindings: { CUSTOMER_ACCOUNT_ENABLED:"true",
    CUSTOMER_ACCOUNT_SECRET:"test-only-afnan-customer-secret-with-more-than-64-characters-abcdef",
    EMAIL_SENDER_VERIFIED:"true" },
});
const sha=(x)=>createHash("sha256").update(x).digest("hex");
const eq=(a,b,m)=>assert.deepEqual(a,b,m);
try {
  const user=new Client(mf), outsider=new Client(mf);
  const email="buyer@example.com", other="other@example.com";
  eq((await user.request("/customer-account/config")).body.enabled,true,"Explicit test activation");
  await user.request("/me");
  const guestToken=user.cookies.get("afnan_guest");
  assert.match(guestToken,/^[a-f0-9]{64}$/);
  const orderId=randomUUID();
  await db.prepare(
    "INSERT INTO orders(id,owner,idempotency_key,request_hash,email,customer,address,zone_id,delivery_kobo,total_kobo,status,payment_method) VALUES(?,?,?,?,?,?,?,?,100000,800000,'pending','bank_transfer')"
  ).bind(orderId,"guest:"+sha(guestToken),randomUUID(),"fixture",email,"{}","{}",zoneId).run();
  // Merely knowing an email does not prove the guest order is yours.
  eq((await user.request("/customer-account/orders")).status,401,"Anonymous history blocked");
  const challenge=await user.request("/customer-account/request","POST",{email});
  eq(challenge.status,200,"Code requested");
  const code=(await db.prepare("SELECT code FROM test_outbox WHERE email=?").bind(email).first()).code;
  assert.match(code,/^\d{8}$/);
  const verified=await user.request("/customer-account/verify","POST",{email,challenge:challenge.body.challenge,code});
  eq(verified.status,200,"Verified email establishes customer session");
  assert.ok(user.cookies.has("afnan_customer"),"Customer-only cookie");
  eq((await user.request("/customer-account/orders")).body.orders.length,0,"No guest claim by matching email");
  eq((await user.request("/customer-account/verify","POST",{email,challenge:challenge.body.challenge,code})).status,401,"OTP replay refused");

  // A second verified account cannot claim the original guest's private order.
  await outsider.request("/me");
  const challenge2=await outsider.request("/customer-account/request","POST",{email:other});
  const code2=(await db.prepare("SELECT code FROM test_outbox WHERE email=?").bind(other).first()).code;
  eq((await outsider.request("/customer-account/verify","POST",{email:other,challenge:challenge2.body.challenge,code:code2})).status,200,"Other customer signed in");
  eq((await outsider.request("/customer-account/orders/claim","POST",{id:orderId})).status,404,"Foreign guest cookie blocked");
  // Even a copied guest cookie cannot claim an order under the wrong verified email.
  outsider.cookies.set("afnan_guest",guestToken);
  eq((await outsider.request("/customer-account/orders/claim","POST",{id:orderId})).status,404,"Mismatched verified email blocked");
  eq((await user.request("/customer-account/orders/claim","POST",{id:orderId})).status,200,"Matching email + guest cookie can claim");
  eq((await user.request("/customer-account/orders")).body.orders[0].id,orderId,"Private history displays linked order");
  eq((await outsider.request("/customer-account/orders")).body.orders.length,0,"Account session isolation");
  eq((await outsider.request("/customer-account/orders/claim","POST",{id:orderId})).status,404,"Cannot steal claimed order");
  eq((await user.request("/customer-account/logout","POST",{})).status,200,"Logout succeeds");
  eq((await user.request("/customer-account/orders")).status,401,"Session revoked");
  eq((await db.prepare("SELECT count(*) count FROM orders WHERE id=?").bind(orderId).first()).count,1,"Historic order preserved");
  eq((await db.prepare("SELECT count(*) count FROM customer_order_links WHERE order_id=?").bind(orderId).first()).count,1,"Single link");
  eq((await db.prepare("SELECT count(*) count FROM staff").first()).count,0,"No staff granted");
  eq((await db.prepare("SELECT quick_check FROM pragma_quick_check").first()).quick_check,"ok","Database integrity");
  console.log("Afnan optional account isolation, OTP replay, guest-token and email ownership checks passed.");
} finally { await mf.dispose(); }
