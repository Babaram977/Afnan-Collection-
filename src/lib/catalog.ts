/**
 * Catalog model + local data source.
 * PRODUCTS is intentionally empty: no real product records have been supplied.
 * Replace `listProducts`/`getProduct` with API calls (see docs/design/AFNAN-UI-STANDARD.md).
 */
export type AgeGroup = "newborn" | "baby" | "toddler" | "kids";
export type CategorySlug =
  | "clothing" | "shoes" | "accessories" | "diapers" | "feeding" | "nursery"
  | "toys" | "books" | "bath-care" | "school" | "gifts";

export interface ProductVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
  priceKobo: number; // integer minor units (NGN kobo)
  stock: number | null; // null = not tracked / unknown
}
export interface ProductImage { url: string; alt: string }
export interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: CategorySlug;
  ageGroups: AgeGroup[];
  images: ProductImage[];
  variants: ProductVariant[];
  safetyNotes?: string; // only when factual data exists
  ageGuidance?: string; // only when factual data exists
  featured?: boolean;
  seasonal?: boolean;
}

export const AGE_GROUPS: { slug: AgeGroup; label: string; range: string; tone: string }[] = [
  { slug: "newborn", label: "Newborn", range: "0–3 months", tone: "bg-blush" },
  { slug: "baby", label: "Baby", range: "3–12 months", tone: "bg-butter" },
  { slug: "toddler", label: "Toddler", range: "1–3 years", tone: "bg-sage" },
  { slug: "kids", label: "Kids", range: "4 years +", tone: "bg-sky" },
];

export const CATEGORIES: { slug: CategorySlug; label: string }[] = [
  { slug: "clothing", label: "Clothing" },
  { slug: "shoes", label: "Shoes" },
  { slug: "accessories", label: "Accessories" },
  { slug: "diapers", label: "Diapers" },
  { slug: "feeding", label: "Feeding" },
  { slug: "nursery", label: "Blankets & Nursery" },
  { slug: "toys", label: "Toys & Learning" },
  { slug: "books", label: "Books" },
  { slug: "bath-care", label: "Bath & Care" },
  { slug: "school", label: "School Essentials" },
  { slug: "gifts", label: "Gifts" },
];

export const PRODUCTS: Product[] = [];

/** Currency is fixed to NGN; amounts only ever come from product records. */
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(kobo / 100);
}

export function priceRange(p: Product): { min: number; max: number } | null {
  if (!p.variants.length) return null;
  const prices = p.variants.map((v) => v.priceKobo);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export interface ProductFilters {
  q?: string | undefined;
  age?: AgeGroup | undefined;
  category?: CategorySlug | undefined;
  size?: string | undefined;
  minNaira?: number | undefined;
  maxNaira?: number | undefined;
}

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  const q = f.q?.trim().toLowerCase();
  return products.filter((p) => {
    if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.age && !p.ageGroups.includes(f.age)) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.size && !p.variants.some((v) => v.size === f.size)) return false;
    const r = priceRange(p);
    if (f.minNaira != null && (!r || r.max < f.minNaira * 100)) return false;
    if (f.maxNaira != null && (!r || r.min > f.maxNaira * 100)) return false;
    return true;
  });
}

export async function listProducts(): Promise<Product[]> { return PRODUCTS; }
export async function getProduct(slug: string): Promise<Product | null> {
  return PRODUCTS.find((p) => p.slug === slug) ?? null;
}
export function allSizes(products: Product[]): string[] {
  return [...new Set(products.flatMap((p) => p.variants.map((v) => v.size).filter(Boolean) as string[]))];
}
