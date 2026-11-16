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
export async function sendSignInCode(env: CommerceEnv, email: string, otp: string) {
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
      from: env.EMAIL_FROM,
      to: email,
      subject: "Your Afnan sign-in code",
      text: `Your sign-in code is ${otp}. It expires in 5 minutes. Never share it. If you did not request it, ignore this email.`,
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
// Staff notice that payment evidence awaits review. Contains no receipt link or file: staff open
// the authenticated admin dashboard. Returns a delivery state; it never throws, so a failed
// notice cannot change an order or payment.
export async function sendPaymentReviewNotice(
  env: CommerceEnv,
  to: string,
  notice: { reference: string; totalNaira: string },
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
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject: `Payment evidence to review: ${notice.reference}`,
        text: `A customer submitted bank-transfer payment evidence for order ${notice.reference} (total ${notice.totalNaira}).\n\nReview it in the Afnan admin dashboard: ${env.APP_ORIGIN}/admin\n\nConfirm the credit in the Moniepoint account before approving. Do not forward receipts outside the dashboard.`,
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
