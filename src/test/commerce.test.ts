import { describe, expect, it, vi, afterEach } from "vitest";
import { orderInput, productInput, variantInput } from "@/backend/validation";
import { paymentEnabled, initialize, verify, validSignature } from "@/backend/payments";
import { cartReducerAdd, restoreCart } from "@/lib/cart";
import { createHmac } from "node:crypto";
import type { CommerceEnv } from "@/backend/types";
const env = {
  APP_ENV: "development",
  APP_ORIGIN: "http://localhost:8787",
  PAYMENT_MODE: "test",
  PAYSTACK_SECRET_KEY: "sk_test_controlled_fixture",
  AUTH_SECRET: "test-secret",
} as CommerceEnv;
afterEach(() => vi.unstubAllGlobals());
describe("commerce trust boundaries", () => {
  it("rejects fractional/negative inventory quantities and money", () => {
    expect(orderInput.safeParse({ lines: [] }).success).toBe(false);
    expect(
      variantInput.safeParse({ productId: crypto.randomUUID(), sku: "X", priceKobo: 0.5 }).success,
    ).toBe(false);
    expect(
      variantInput.safeParse({ productId: crypto.randomUUID(), sku: "X", priceKobo: -1 }).success,
    ).toBe(false);
  });
  it("rejects injected image URLs", () => {
    const p = {
      slug: "valid",
      name: "Name",
      category: "clothing",
      ageGroups: [],
      images: [{ url: "javascript:alert(1)", alt: "X" }],
      status: "draft",
    };
    expect(productInput.safeParse(p).success).toBe(false);
  });
  it("does not support live keys or fixture mode outside the controlled test origin", () => {
    expect(paymentEnabled({ ...env, PAYSTACK_SECRET_KEY: "sk_live_not_a_real_key" })).toBeFalsy();
    expect(
      paymentEnabled({
        ...env,
        PAYMENT_MODE: "fixture",
        APP_ENV: "production",
        TEST_FIXTURES: "true",
      }),
    ).toBeFalsy();
    expect(
      paymentEnabled({
        ...env,
        PAYMENT_MODE: "fixture",
        APP_ENV: "test",
        TEST_FIXTURES: "true",
        APP_ORIGIN: "https://afnancollectionkn.com",
      }),
    ).toBeFalsy();
  });
  it("initializes Paystack with server amount, NGN and fixed reference", async () => {
    const fn = vi.fn().mockResolvedValue(
      Response.json({
        status: true,
        data: { authorization_url: "https://checkout.paystack.com/test" },
      }),
    );
    vi.stubGlobal("fetch", fn);
    const result = await initialize(env, {
      id: "reference",
      email: "fixture@example.com",
      total_kobo: 300000,
    });
    expect(result.reference).toBe("reference");
    expect(JSON.parse(fn.mock.calls[0]?.[1].body)).toMatchObject({
      amount: 300000,
      currency: "NGN",
      reference: "reference",
    });
  });
  it("rejects an unexpected provider redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ status: true, data: { authorization_url: "https://evil.example" } }),
        ),
    );
    await expect(
      initialize(env, { id: "reference", email: "fixture@example.com", total_kobo: 1 }),
    ).rejects.toThrow("Unexpected payment URL");
  });
  it("verifies transactions through the server endpoint", async () => {
    const fn = vi.fn().mockResolvedValue(
      Response.json({
        status: true,
        data: {
          id: 123,
          reference: "reference",
          status: "success",
          amount: 300000,
          currency: "NGN",
        },
      }),
    );
    vi.stubGlobal("fetch", fn);
    expect(await verify(env, "reference")).toEqual({
      id: "123",
      reference: "reference",
      status: "success",
      amount: 300000,
      currency: "NGN",
    });
    expect(fn.mock.calls[0]?.[0]).toBe("https://api.paystack.co/transaction/verify/reference");
  });
  it("checks the signature over the original body bytes", () => {
    const raw = '{"event":"charge.success"}';
    const signature = createHmac("sha512", env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex");
    expect(validSignature(raw, signature, env)).toBe(true);
    expect(validSignature(raw + " ", signature, env)).toBe(false);
  });
  it("rehydrates cart prices from catalog and removes invalid persisted state", () => {
    expect(restoreCart([{ variantId: "invalid", qty: -1 }], [])).toEqual([]);
    const line = {
      productId: "a",
      variantId: "b",
      name: "Name",
      variantLabel: "",
      priceKobo: 1,
      qty: 1,
    };
    expect(cartReducerAdd([], { ...line, qty: 0.5 })).toEqual([]);
    expect(cartReducerAdd([{ ...line, qty: 99 }], line)[0]?.qty).toBe(99);
  });
});
