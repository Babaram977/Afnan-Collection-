import { testMode, type CommerceEnv } from "./types";

// Provider-issued DNS records and mailbox ownership are deployment gates, not inferred here.
export function validateSender(env: CommerceEnv) {
  if (
    !env.RESEND_API_KEY ||
    !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY) ||
    env.EMAIL_FROM !== "noreply@afnancollectionkn.com" ||
    env.EMAIL_SENDER_VERIFIED !== "true"
  )
    throw new Error("Email delivery is not configured");
}
export async function sendSignInCode(
  env: CommerceEnv,
  email: string,
  otp: string,
  expiryMinutes = 5,
) {
  if (testMode(env)) {
    await env.DB.prepare(
      "INSERT INTO test_outbox(email,code) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code,created_at=unixepoch()",
    )
      .bind(email, otp)
      .run();
    return;
  }
  validateSender(env);
  // Never log the request, recipient, provider response or OTP. No automatic retries.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Recognizable verified brand identity; retains the approved authenticated sender address.
      from: `Afnan Collection <${env.EMAIL_FROM}>`,
      to: email,
      subject: "Afnan Collection — your sign-in verification code",
      text: `Afnan Collection\n\nYour one-time verification code is ${otp}.\n\nThis code expires in ${expiryMinutes} minutes. Enter it only on afnancollectionkn.com. Never share it with anyone.\n\nIf you did not request this code, you can safely ignore this message.\n\nAfnan Collection Customer Accounts`,
    }),
  });
  await response.body?.cancel();
  // Status code only: never the recipient, code, key or provider response body.
  if (!response.ok) {
    console.error(
      JSON.stringify({ event: "auth.email.provider_rejected", status: response.status }),
    );
    throw new Error("Email delivery failed");
  }
  console.log(JSON.stringify({ event: "auth.email.accepted" }));
}
// Staff notice (new order, payment evidence, late payment). Contains no receipt link, file or
// customer contact details: staff open the authenticated admin dashboard. Returns a delivery state
// and never throws, so a failed notice cannot change an order or payment. A provider-accepted email
// is recorded as "sent", which means accepted by Resend, not confirmed delivered.
export async function sendStaffNotice(
  env: CommerceEnv,
  to: string,
  notice: { subject: string; text: string; idempotencyKey: string },
): Promise<{ status: "sent" | "failed" | "unconfigured" | "test"; error?: string }> {
  if (testMode(env)) return { status: "test" };
  try {
    validateSender(env);
  } catch {
    return { status: "unconfigured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": notice.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject: notice.subject,
        text: notice.text,
      }),
    });
    await response.body?.cancel();
    return response.ok
      ? { status: "sent" }
      : { status: "failed", error: `http_${response.status}` };
  } catch {
    return { status: "failed", error: "network" };
  }
}
