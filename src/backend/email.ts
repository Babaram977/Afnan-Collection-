import { testMode, type CommerceEnv } from "./types";

// Provider-issued DNS records and mailbox ownership are deployment gates, not inferred here.
export function validateSender(env: CommerceEnv) {
  if (
    !env.RESEND_API_KEY ||
    !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY) ||
    env.EMAIL_FROM !== "orders@afnancollectionkn.com" ||
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
  if (!response.ok) throw new Error("Email delivery failed");
}
