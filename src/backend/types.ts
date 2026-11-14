export interface CommerceEnv
  extends Pick<WorkerBindings, "DB">, Partial<Pick<WorkerBindings, "MEDIA">> {
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
}
export const testMode = (env: CommerceEnv) =>
  env.APP_ENV === "test" &&
  env.TEST_FIXTURES === "true" &&
  new URL(env.APP_ORIGIN).hostname === "localhost";
