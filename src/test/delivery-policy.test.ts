import { describe, it, expect } from "vitest";
import {
  afnanDelivery,
  FREE_DELIVERY_THRESHOLD_KOBO,
  KANO_DELIVERY_KOBO,
} from "../lib/delivery-policy";
describe("Afnan approved fulfilment policy", () => {
  it("charges ₦1,500 for Kano orders below ₦250,000", () => {
    expect(KANO_DELIVERY_KOBO).toBe(150_000);
    expect(afnanDelivery(24_999_999, "delivery", "Kano").feeKobo).toBe(150_000);
  });
  it("makes Kano delivery free at and above ₦250,000", () => {
    expect(FREE_DELIVERY_THRESHOLD_KOBO).toBe(25_000_000);
    expect(afnanDelivery(25_000_000, "delivery", "Kano").feeKobo).toBe(0);
    expect(afnanDelivery(30_000_000, "delivery", "Kano State").feeKobo).toBe(0);
  });
  it("never collects interstate carrier transport money", () => {
    for (const n of [20_000_000, 25_000_000, 50_000_000])
      expect(afnanDelivery(n, "delivery", "Kaduna")).toEqual({
        kind: "interstate",
        feeKobo: 0,
        carrierDirect: true,
      });
  });
  it("makes pickup free with no destination required", () => {
    for (const n of [50_000, 24_000_000, 30_000_000])
      expect(afnanDelivery(n, "pickup", "")).toEqual({
        kind: "pickup",
        feeKobo: 0,
        carrierDirect: false,
      });
  });
  it("rejects invalid input", () => {
    expect(() => afnanDelivery(-1, "delivery", "Kano")).toThrow();
    expect(() => afnanDelivery(120_000, "delivery", "")).toThrow();
  });
});
