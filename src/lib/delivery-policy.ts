/** Approved delivery rules for NEW Afnan Collection orders only (do not rewrite old orders). */
export const FREE_DELIVERY_THRESHOLD_KOBO = 25_000_000; // ₦250,000
export const KANO_DELIVERY_KOBO = 150_000; // ₦1,500
export type FulfilmentMethod = "delivery" | "pickup";
export const FULFILMENT_ZONE_IDS = {
  pickup: "c3b0d60b-bbc3-4542-958a-f81b5f6e50fd",
  kano: "3c28076b-0e9f-4c76-97c5-e52d07aa2b8e",
  interstate: "4dce8f67-efc6-472d-89ce-66396973e985",
} as const;
export function afnanDelivery(subtotalKobo: number, method: FulfilmentMethod, state: string) {
  if (!Number.isSafeInteger(subtotalKobo) || subtotalKobo < 0) throw Error("Invalid subtotal");
  if (method === "pickup") return { kind: "pickup" as const, feeKobo: 0, carrierDirect: false };
  if (method !== "delivery" || !state.trim())
    throw Error("A valid fulfilment method and state are required");
  const kano = /^(kano|kano state)$/i.test(state.trim());
  if (!kano) return { kind: "interstate" as const, feeKobo: 0, carrierDirect: true };
  return subtotalKobo >= FREE_DELIVERY_THRESHOLD_KOBO
    ? { kind: "kano" as const, feeKobo: 0, carrierDirect: false }
    : { kind: "kano" as const, feeKobo: KANO_DELIVERY_KOBO, carrierDirect: false };
}
