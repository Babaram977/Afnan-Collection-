import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";
import { testMode, type CommerceEnv } from "./types";

export function authFor(env: CommerceEnv) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
    throw new Error("Authentication is not configured");
  return betterAuth({
    appName: "Afnan Collection Online",
    baseURL: env.APP_ORIGIN,
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.APP_ORIGIN],
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite", schema }),
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: new URL(env.APP_ORIGIN).protocol === "https:",
    },
    rateLimit: { enabled: true, storage: "memory", window: 60, max: 10 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          if (testMode(env)) {
            await env.DB.prepare(
              "INSERT INTO test_outbox(email,code) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code,created_at=unixepoch()",
            )
              .bind(email, otp)
              .run();
            return;
          }
          if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
            throw new Error("Email delivery is not configured");
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM,
              to: email,
              subject: "Your Afnan sign-in code",
              text: `Your sign-in code is ${otp}. It expires in 5 minutes. If you did not request it, ignore this email.`,
            }),
          });
          if (!response.ok) throw new Error("Email delivery failed");
        },
      }),
    ],
  });
}
