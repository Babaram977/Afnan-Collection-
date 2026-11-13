import { z } from "zod";
export const money = z.number().int().min(0).max(1_000_000_000);
const text = z.string().trim().min(1).max(200);
export const safeImage = z
  .string()
  .max(500)
  .refine(
    (v) => /^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v),
    "Upload product images through media storage",
  );
export const productInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  name: text,
  description: z.string().max(5000).default(""),
  category: text,
  ageGroups: z.array(z.enum(["newborn", "baby", "toddler", "kids"])).max(4),
  images: z.array(z.object({ url: safeImage, alt: text })).max(12),
  status: z.enum(["draft", "active", "archived"]),
  featured: z.boolean().default(false),
  seasonal: z.boolean().default(false),
  ageGuidance: z.string().max(2000).default(""),
  safetyNotes: z.string().max(2000).default(""),
});
export const variantInput = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  sku: text,
  size: z.string().max(80).default(""),
  color: z.string().max(80).default(""),
  priceKobo: money.min(1),
  lowStock: z.number().int().min(0).max(100000).default(3),
});
export const linesInput = z
  .array(z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
  .min(1)
  .max(50)
  .refine(
    (lines) => new Set(lines.map((l) => l.variantId)).size === lines.length,
    "Duplicate variants",
  );
export const addressInput = z.object({
  street: z.string().trim().min(5).max(500),
  city: text,
  state: text,
});
export const orderInput = z.object({
  lines: linesInput,
  customer: z.object({
    name: text,
    phone: z.string().regex(/^\+?[0-9 ()-]{7,20}$/),
    email: z.string().email().max(254),
  }),
  address: addressInput,
  zoneId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});
export const stockInput = z.object({
  variantId: z.string().uuid(),
  delta: z
    .number()
    .int()
    .min(-100000)
    .max(100000)
    .refine((x) => x !== 0),
  reason: z.string().trim().min(3).max(200),
});
export const zoneInput = z.object({
  id: z.string().uuid().optional(),
  name: text,
  state: text,
  feeKobo: money,
  active: z.boolean(),
});
export const bannerInput = z.object({
  id: z.string().uuid().optional(),
  title: text,
  href: z
    .string()
    .regex(/^\/(shop(?:\?.*)?|product\/[a-z0-9-]+)$/)
    .max(300),
  imageUrl: z.union([safeImage, z.literal("")]).default(""),
  active: z.boolean(),
});
export const policyInput = z.object({
  key: z.enum(["about", "contact", "privacy", "returns", "delivery"]),
  value: z.string().max(10000),
});
