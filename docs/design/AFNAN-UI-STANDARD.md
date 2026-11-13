# Afnan Collection Online — UI Standard (v0.1)

Frontend-only storefront. No backend, auth, payments or real orders are connected.
Brand: text wordmark "Afnan Collection Online" (`src/components/site/Wordmark.tsx`) until an official logo is supplied. No tagline.

## Design tokens (`src/styles.css`, oklch)
| Token | Purpose |
|---|---|
| `--background` warm cream, `--card` near-white cream | surfaces |
| `--foreground` cocoa brown | body text (AA on cream) |
| `--primary` terracotta | CTAs, prices, focus ring |
| `--secondary`, `--muted` | soft panels |
| `--accent` / `--sage`, `--sky`, `--butter`, `--blush` | age-group & category tints |
| `--warning` / `--warning-foreground` | "not connected" notices |
| `--shadow-soft`, `--radius` 0.875rem | elevation, rounding |
Fonts: Fraunces (headings, `font-display`), Nunito Sans (body). Utilities: `container-page`, `shadow-soft`, `placeholder-pattern`.

## Components (`src/components/site`)
Wordmark · SiteHeader (desktop nav + mobile Sheet, skip link, cart count) · SiteFooter · PageHeader · ProductCard / ProductGrid / ProductImageOrPlaceholder · EmptyState · NotConnected badge. shadcn/ui primitives under `src/components/ui`.

## Routes
| Path | Status |
|---|---|
| `/` | Working. Age & category entry; featured/seasonal sections render only when products have those flags |
| `/shop?q&age&category&size&minNaira&maxNaira` | Working client-side filtering (URL state) |
| `/product/$slug` | Working; variants, gallery, description, age guidance and safety render only if present in data |
| `/cart` | Working (React context + localStorage) |
| `/checkout` | UI shell; place-order disabled, nothing submitted |
| `/about`, `/contact`, `/policies` | Content placeholders; no invented details or terms |
| `/admin` | Read-only views of local data; all writes disabled, no auth |

## Data model (`src/lib/catalog.ts`)
`Product { id, slug, name, description?, category, ageGroups[], images[{url,alt}], variants[], safetyNotes?, ageGuidance?, featured?, seasonal? }`
`ProductVariant { id, sku, size?, color?, priceKobo (integer), stock (number|null) }`
Money is integer kobo, displayed via `formatNaira`. `PRODUCTS` is empty — no products were supplied.

## API contracts for backend handoff (proposed)
Replace `listProducts()` / `getProduct()` with these; keep the shapes above.
- `GET /api/products?q&age&category&size&minNaira&maxNaira` → `Product[]`
- `GET /api/products/:slug` → `Product` | 404
- `GET /api/categories` → `{slug,label}[]`
- `GET /api/banners` → `{id,title,imageUrl,href,active}[]`
- `POST /api/orders` `{ lines:[{variantId,qty}], customer:{name,phone,email}, address:{street,city,state} }` → `{ orderId, totalKobo, paymentUrl? }` (server recomputes prices and stock)
- `POST /api/payments/webhook` — provider callback, verify signature
- Admin (auth + role `admin`): `POST|PATCH|DELETE /api/admin/{products,variants,categories,banners}`, `PATCH /api/admin/inventory/:variantId {stock}`, `GET|PATCH /api/admin/orders`

## Rules
No fabricated products, prices, stock, photos, reviews, discounts, contact details, delivery promises or payment results. Unfinished features are disabled and labelled "not connected".
