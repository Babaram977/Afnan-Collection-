import { createHmac, timingSafeEqual } from "node:crypto";
import type { CommerceEnv } from "./types";
import { testMode } from "./types";
export interface VerifiedPayment {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  id: string;
}
export function paymentEnabled(env: CommerceEnv) {
  return (
    (testMode(env) && env.PAYMENT_MODE === "fixture") ||
    (env.PAYMENT_MODE === "test" && env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_"))
  );
}
function key(env: CommerceEnv) {
  if (!paymentEnabled(env)) throw new Error("Payments are disabled");
  return env.PAYSTACK_SECRET_KEY ?? env.AUTH_SECRET;
}
export function validSignature(raw: string, signature: string, env: CommerceEnv) {
  const expected = createHmac("sha512", key(env)).update(raw).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
async function paystack(env: CommerceEnv, path: string, body?: object) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key(env)}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const result = (await response.json()) as { status: boolean; data: Record<string, unknown> };
  if (!response.ok || !result.status) throw new Error("Payment provider unavailable");
  return result.data;
}
export async function initialize(
  env: CommerceEnv,
  order: { id: string; email: string; total_kobo: number },
) {
  if (!paymentEnabled(env)) throw new Error("Payments are disabled");
  if (testMode(env) && env.PAYMENT_MODE === "fixture") {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO test_provider_transactions(reference,amount,currency,status,provider_id) VALUES(?,?,'NGN','success',?)",
    )
      .bind(order.id, order.total_kobo, `fixture-${order.id}`)
      .run();
    return {
      reference: order.id,
      authorization_url: `${env.APP_ORIGIN}/account?order=${order.id}`,
    };
  }
  const data = await paystack(env, "/transaction/initialize", {
    reference: order.id,
    amount: order.total_kobo,
    email: order.email,
    currency: "NGN",
    callback_url: `${env.APP_ORIGIN}/account?order=${order.id}`,
  });
  const url = String(data["authorization_url"]);
  if (new URL(url).origin !== "https://checkout.paystack.com")
    throw new Error("Unexpected payment URL");
  return { reference: order.id, authorization_url: url };
}
export async function verify(env: CommerceEnv, reference: string): Promise<VerifiedPayment> {
  if (testMode(env) && env.PAYMENT_MODE === "fixture") {
    const payment = await env.DB.prepare(
      "SELECT * FROM test_provider_transactions WHERE reference=?",
    )
      .bind(reference)
      .first<{
        reference: string;
        amount: number;
        currency: string;
        status: string;
        provider_id: string;
      }>();
    if (!payment) throw new Error("Unknown provider fixture");
    return {
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      id: payment.provider_id,
    };
  }

  const data = await paystack(env, `/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    reference: String(data["reference"]),
    amount: Number(data["amount"]),
    currency: String(data["currency"]),
    status: String(data["status"]),
    id: String(data["id"]),
  };
}

export async function requestRefund(env: CommerceEnv, reference: string, amount: number) {
  if (testMode(env) && env.PAYMENT_MODE === "fixture") return `refund-fixture-${reference}`;
  const result = await paystack(env, "/refund", {
    transaction: reference,
    amount,
    reference: `refund-${reference}`,
  });
  if (!result["id"]) throw new Error("Refund reference unavailable");
  return String(result["id"]);
}
export async function verifyRefund(
  env: CommerceEnv,
  refundId: string,
  providerId: string,
  amount: number,
) {
  if (testMode(env) && env.PAYMENT_MODE === "fixture") return "processed";
  const result = await paystack(env, `/refund/${encodeURIComponent(refundId)}`);
  if (
    String(result["transaction"]) !== providerId ||
    Number(result["amount"]) !== amount ||
    result["currency"] !== "NGN"
  )
    throw new Error("Refund verification mismatch");
  return String(result["status"]);
}
