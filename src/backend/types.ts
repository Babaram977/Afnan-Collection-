export interface CommerceEnv
  extends Pick<WorkerBindings, "DB">, Partial<Pick<WorkerBindings, "MEDIA">> {
  // Private bucket for customer payment receipts; never served publicly.
  RECEIPTS?: R2Bucket;
  APP_ENV: string;
  APP_ORIGIN: string;
  AUTH_SECRET: string;
  CHECKOUT_ENABLED: string;
  PAYMENT_MODE: string;
  PAYSTACK_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_SENDER_VERIFIED?: string;
  TEST_FIXTURES?: string;
  // "password": administrators sign in with email + password (owner decision 2026-11-16).
  // Unset or anything else: email code + mandatory WebAuthn (original model).
  ADMIN_AUTH_MODE?: string;
}
export const testMode = (env: CommerceEnv) =>
  env.APP_ENV === "test" &&
  env.TEST_FIXTURES === "true" &&
  new URL(env.APP_ORIGIN).hostname === "localhost";

export const passwordAdmin = (env: CommerceEnv) => env.ADMIN_AUTH_MODE === "password";
