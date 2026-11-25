import type { CommerceEnv } from "./types";
import { sendSignInCode, validateSender } from "./email";
import { testMode } from "./types";

export class CustomerAccountError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new CustomerAccountError(status, message); };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const now = () => Math.floor(Date.now() / 1000);
const encode = new TextEncoder();
const sha = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encode.encode(value))), x => x.toString(16).padStart(2, "0")).join("");
const hexToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join("");
const emailInput = (value: unknown) => {
  if (typeof value !== "string") return fail(400, "Invalid email");
  if (value.length > 254) return fail(400, "Invalid email");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "Invalid email");
  return email;
};
function enabled(env: CommerceEnv) {
  if (env.CUSTOMER_ACCOUNT_ENABLED !== "true" || !env.CUSTOMER_ACCOUNT_SECRET ||
      env.CUSTOMER_ACCOUNT_SECRET.length < 64 || env.EMAIL_SENDER_VERIFIED !== "true")
    fail(503, "Customer accounts unavailable");
  if (!testMode(env)) {
    try { validateSender(env); }
    catch { fail(503, "Customer accounts unavailable"); }
  }
}
async function signature(env: CommerceEnv, challenge: string, email: string, code: string) {
  return sha(env.CUSTOMER_ACCOUNT_SECRET + ":" + challenge + ":" + email + ":" + code);
}
function code8() {
  const cap = Math.floor(0x100000000 / 100000000) * 100000000;
  let number: number;
  do { number = crypto.getRandomValues(new Uint32Array(1))[0]!; } while (number >= cap);
  return String(number % 100000000).padStart(8, "0");
}
function cookie(token: string, env: CommerceEnv, expires = 604800) {
  return (env.APP_ORIGIN.startsWith("https:") ? "__Host-afnan-customer" : "afnan_customer") +
    "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + expires +
    (env.APP_ORIGIN.startsWith("https:") ? "; Secure" : "");
}
function tokenFromRequest(request: Request, env: CommerceEnv) {
  const name = env.APP_ORIGIN.startsWith("https:") ? "__Host-afnan-customer" : "afnan_customer";
  return request.headers.get("Cookie")?.split(";").map(x=>x.trim())
    .find(x=>x.startsWith(name+"="))?.slice(name.length+1) ?? "";
}
async function identity(request: Request, env: CommerceEnv) {
  enabled(env);
  const token = tokenFromRequest(request, env);
  if (!/^[a-f0-9]{64}$/.test(token)) fail(401, "Customer sign-in required");
  const row = await env.DB.prepare(
    "SELECT p.id,p.email FROM customer_account_sessions s JOIN customer_account_profiles p ON p.id=s.customer_id " +
    "WHERE s.token_hash=? AND s.expires_at>?"
  ).bind(await sha(token), now()).first<{id:string,email:string}>();
  if (!row) return fail(401, "Customer sign-in required");
  return row;
}
export async function customerAccounts(request: Request, env: CommerceEnv, input?:unknown): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === "/api/customer-account/config" && request.method === "GET") {
    let configured = false;
    try { enabled(env); configured = true; } catch { /* Fail closed without leaking details. */ }
    return json({ enabled: configured });
  }
  enabled(env);
  if (path === "/api/customer-account/request" && request.method === "POST") {
    const {email: raw} = (input ?? {}) as {email?:unknown};
    const email = emailInput(raw);
    // Existing staff addresses must not create a second customer identity or bypass staff controls.
    const staff = await env.DB.prepare("SELECT 1 FROM user u JOIN staff s ON s.user_id=u.id WHERE lower(u.email)=?").bind(email).first();
    if (staff) fail(403, "Staff should use Store Management");
    const id = crypto.randomUUID(), code = code8(), time = now();
    const accepted = await env.DB.prepare(
      "INSERT INTO customer_account_challenges(id,email,code_hash,expires_at,created_at) " +
      "SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM customer_account_challenges WHERE email=? AND created_at>?) RETURNING id"
    ).bind(id,email,await signature(env,id,email,code),time+600,time,email,time-60).first();
    // Keep same public response on cooldown; no email contents or account existence disclosed.
    if (accepted) await sendSignInCode(env,email,code,10);
    return json({ accepted:true,challenge:id });
  }
  if (path === "/api/customer-account/verify" && request.method === "POST") {
    const {email:raw, challenge, code} = (input ?? {}) as {email?:unknown,challenge?:unknown,code?:unknown};
    const email=emailInput(raw);
    if(typeof challenge!=="string" || !/^[0-9a-f-]{36}$/.test(challenge)) return fail(401,"Invalid or expired verification code");
    if(typeof code!=="string" || !/^\d{8}$/.test(code)) return fail(401,"Invalid or expired verification code");
    const time=now();
    const digest=await signature(env,challenge,email,code);
    const token=hexToken(),tokenHash=await sha(token),customerId=crypto.randomUUID();
    const check = await env.DB.prepare(
      "SELECT id FROM customer_account_challenges WHERE id=? AND email=? AND used=0 AND expires_at>? AND attempts<5"
    ).bind(challenge,email,time).first();
    if (!check) fail(401,"Invalid or expired verification code");
    const valid = await env.DB.prepare(
      "UPDATE customer_account_challenges SET attempts=attempts+1,used=CASE WHEN code_hash=? THEN 1 ELSE 0 END " +
      "WHERE id=? AND email=? AND used=0 AND expires_at>? AND attempts<5 RETURNING used"
    ).bind(digest,challenge,email,time).first<{used:number}>();
    if (valid?.used !== 1) fail(401,"Invalid or expired verification code");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO customer_account_profiles(id,email,verified_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING")
        .bind(customerId,email,time),
      env.DB.prepare("INSERT INTO customer_account_sessions(token_hash,customer_id,expires_at) SELECT ?,id,? FROM customer_account_profiles WHERE email=?")
        .bind(tokenHash,time+604800,email),
    ]);
    const response=json({verified:true});
    response.headers.append("Set-Cookie",cookie(token,env));
    return response;
  }
  if (path === "/api/customer-account/session" && request.method === "GET")
    return json(await identity(request,env));
  if (path === "/api/customer-account/logout" && request.method === "POST") {
    const token = tokenFromRequest(request,env);
    if (/^[a-f0-9]{64}$/.test(token)) await env.DB.prepare("DELETE FROM customer_account_sessions WHERE token_hash=?").bind(await sha(token)).run();
    const response=json({signedOut:true});
    response.headers.append("Set-Cookie",cookie("",env,0));
    return response;
  }
  if (path === "/api/customer-account/orders" && request.method === "GET") {
    const customer=await identity(request,env);
    const rows=await env.DB.prepare(
      "SELECT o.id,o.reference,o.status,o.total_kobo,o.created_at,o.payment_method,o.delivery_kobo, " +
      "(SELECT outcome FROM bank_transfer_approvals a WHERE a.order_id=o.id) AS bank_outcome, " +
      "(SELECT json_group_array(json_object('name',i.name,'sku',i.sku,'qty',i.qty,'price_kobo',i.price_kobo)) FROM order_items i WHERE i.order_id=o.id) AS items " +
      "FROM customer_order_links l JOIN orders o ON o.id=l.order_id WHERE l.customer_id=? " +
      "ORDER BY o.created_at DESC LIMIT 100"
    ).bind(customer.id).all();
    return json({orders:rows.results.map(row=>({ ...row, items: JSON.parse(String(row.items??"[]")) }))});
  }
  if (path === "/api/customer-account/orders/claim" && request.method === "POST") {
    const customer=await identity(request,env);
    const {id} = (input ?? {}) as {id?:unknown};
    if(typeof id!=="string" || !/^[0-9a-f-]{36}$/.test(id)) fail(400,"Invalid order");
    // The original browser-only HttpOnly guest cookie proves possession of the guest order.
    const guestToken=request.headers.get("Cookie")?.match(/(?:^|;\s*)afnan_guest=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(!guestToken) return fail(404,"Order not available on this device");
    const originalOwner="guest:"+await sha(guestToken);
    const linked=await env.DB.prepare("SELECT customer_id FROM customer_order_links WHERE order_id=?").bind(id).first<{customer_id:string}>();
    if(linked) {
      if(linked.customer_id===customer.id) return json({linked:true});
      fail(404,"Order not available for this account");
    }
    const result=await env.DB.prepare(
      "INSERT INTO customer_order_links(order_id,customer_id) SELECT o.id,? FROM orders o " +
      "WHERE o.id=? AND o.owner=? AND lower(trim(o.email))=? " +
      "AND NOT EXISTS(SELECT 1 FROM customer_order_links l WHERE l.order_id=o.id) " +
      "ON CONFLICT(order_id) DO NOTHING"
    ).bind(customer.id,id,originalOwner,customer.email).run();
    if(result.meta.changes!==1) fail(404,"Order not available for this verified account");
    await env.DB.prepare("INSERT INTO audit(actor,action,entity_id) VALUES(?,'customer.order.linked',?)")
      .bind(customer.id,id).run();
    return json({linked:true});
  }
  return fail(404,"Not found");
}
