import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./auth-schema";
import { testMode, type CommerceEnv } from "./types";
import { sendSignInCode } from "./email";

export function authFor(env: CommerceEnv) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32)
    throw new Error("Authentication is not configured");
  return betterAuth({
    appName: "Afnan Collection Online",
    baseURL: env.APP_ORIGIN,
    secret: env.AUTH_SECRET,
    trustedOrigins: [env.APP_ORIGIN],
    // Acceptance identities are provisioned by an approved operator, never public signup.
    disabledPaths: [
      "/sign-up/email",
      "/update-user",
      "/delete-user",
      "/change-email",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
    ],
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: "sqlite", schema }),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: new URL(env.APP_ORIGIN).protocol === "https:",
    },
    rateLimit: { enabled: true, storage: "memory", window: 60, max: 10 },
    logger: { disabled: true },
    plugins: [
      emailOTP({
        disableSignUp: !testMode(env),
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          try {
            await sendSignInCode(env, email, otp);
          } catch {
            console.error(JSON.stringify({ event: "auth.email.unavailable" }));
            throw new Error("Email delivery unavailable");
          }
        },
      }),
    ],
  });
}
