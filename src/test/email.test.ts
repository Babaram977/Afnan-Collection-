import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSignInCode, validateSender } from "../backend/email";
import type { CommerceEnv } from "../backend/types";

const env = {
  APP_ENV: "acceptance",
  APP_ORIGIN: "https://afnancollectionkn.com",
  RESEND_API_KEY: "re_fixture_only",
  EMAIL_FROM: "orders@afnancollectionkn.com",
  EMAIL_SENDER_VERIFIED: "true",
} as CommerceEnv;
afterEach(() => vi.unstubAllGlobals());
describe("transactional email configuration (mocked; never sends email)", () => {
  it("requires explicit sender verification and the approved sender", () => {
    expect(() => validateSender({ ...env, EMAIL_SENDER_VERIFIED: "false" })).toThrow();
    expect(() => validateSender({ ...env, EMAIL_FROM: "invented@example.com" })).toThrow();
    expect(() => validateSender({ ...env, RESEND_API_KEY: "" })).toThrow();
  });
  it("fails closed without making a request when configuration is missing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendSignInCode({ ...env, EMAIL_SENDER_VERIFIED: "false" }, "fixture@example.com", "123456"),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses server-side authorization and a bounded verification template", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await sendSignInCode(env, "fixture@example.com", "123456");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_fixture_only");
    expect(JSON.parse(init.body).text).toContain("expires in 5 minutes");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it("does not expose provider response details or retry failed delivery", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("private-provider-detail", { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    await expect(sendSignInCode(env, "fixture@example.com", "123456")).rejects.toThrow(
      "Email delivery failed",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
});
