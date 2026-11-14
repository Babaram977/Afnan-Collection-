# Afnan Collection Online — UI Standard (v0.2)

## Current implementation update — 2026-11-13

The owner-authorized commerce/admin work preserves all colour, type and layout foundations below. The initial v0.1 snapshot is retained for provenance; its frontend-only status and proposed API labels are historical, superseded by this update and docs/engineering/COMMERCE.md.

- Catalog and dynamic categories now come from D1 through TanStack server functions. Only active, nondeleted products are public. A configured promotional price becomes the effective price; regular price remains available for honest comparison. Variants/SKUs, stock, images and product safety/age text retain the original contract.
- `/account` adds email-code sign-in/recovery, profile/addresses, order history and browser-scoped guest tracking. Cart selections persist locally and in an owner-scoped backend copy; server prices/stock remain authoritative.
- `/checkout` works against the test backend with delivery selection, authoritative totals, idempotent preparation, reservation and confirmation. Checked-in checkout/payment gates stay disabled. No live payments or real customer orders were processed.
- `/admin` is now authenticated and server-authorized. Guided product/photo/option forms, stock adjustments/ledger, order fulfilment, categories, banners, delivery, customer/session views, payment/refund controls, page copy and contact settings replace the read-only preview. No UUID entry is required for routine product/stock operations.
- Photos support multiple uploads, private previews, main-image ordering, replacement/removal and browser WebP resizing to 1600 pixels; storage URLs remain opaque. Product deletion is soft, retaining order history.
- Official owner-supplied contacts and registration details resolve from src/lib/business.ts with validated D1 contact overrides. Registration/tax numbers appear only in business/legal content and are supplied, not independently verified. The checksum-verified original gold AC/black flourish PNG is authoritative and rendered unchanged by the shared Wordmark: 112 px wide in the 144 px header and 176 px wide in the footer, with automatic proportional height and no upscaling. Its original white canvas is retained. PNG icon/Store logo and homepage-only social metadata use the same asset; product metadata remains separate.

Current APIs: `GET /api/products`, `GET /api/products/:slug`, `GET /api/categories`, `GET /api/store`, `GET /api/business`, `GET /api/zones`; Better Auth under `/api/auth/*`; owner-scoped `/api/me`, `/api/profile`, `/api/addresses`, `/api/cart`, `/api/orders` and order detail/cancel/pay actions. Staff APIs under `/api/admin/*` enforce roles on the server; product upsert and soft delete, variant upsert, stock adjustments, media upload/private preview, settings and guarded fulfilment/payment actions are implemented. See source/engineering docs for exact verbs and schemas; v0.1 endpoints below remain historical proposals.

## Local storefront review — 2026-11-14

Preserve all approved tokens, fonts and original PNG. Focused fixes close mobile navigation after link selection, wrap galleries and long product text/quantity controls at narrow widths, show the option label for a single variant, and keep cleared search/price inputs consistent with URL filters. No routes, API contracts, merchandise or new design system were introduced. The local review adds 181 storefront assertions across 320/390/768/1440 px; see docs/engineering/STOREFRONT-REVIEW.md for evidence and limits.

## Preserved v0.1 design and initial handoff snapshot

Frontend-only storefront. No backend, auth, payments or real orders are connected.
Brand: text wordmark "Afnan Collection Online" (`src/components/site/Wordmark.tsx`) until an official logo is supplied. No tagline.

## Design tokens (`src/styles.css`, oklch)

| Token                                                                                                                              | Purpose                    |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `--background` warm cream, `--card` near-white cream                                                                               | surfaces                   |
| `--foreground` cocoa brown                                                                                                         | body text (AA on cream)    |
| `--primary` terracotta                                                                                                             | CTAs, prices, focus ring   |
| `--secondary`, `--muted`                                                                                                           | soft panels                |
| `--accent` / `--sage`, `--sky`, `--butter`, `--blush`                                                                              | age-group & category tints |
| `--warning` / `--warning-foreground`                                                                                               | "not connected" notices    |
| `--shadow-soft`, `--radius` 0.875rem                                                                                               | elevation, rounding        |
| Fonts: Fraunces (headings, `font-display`), Nunito Sans (body). Utilities: `container-page`, `shadow-soft`, `placeholder-pattern`. |

## Components (`src/components/site`)

Wordmark · SiteHeader (desktop nav + mobile Sheet, skip link, cart count) · SiteFooter · PageHeader · ProductCard / ProductGrid / ProductImageOrPlaceholder · EmptyState · NotConnected badge. shadcn/ui primitives under `src/components/ui`.

## Routes

| Path                                          | Status                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/`                                           | Working. Age & category entry; featured/seasonal sections render only when products have those flags |
| `/shop?q&age&category&size&minNaira&maxNaira` | Working client-side filtering (URL state)                                                            |
| `/product/$slug`                              | Working; variants, gallery, description, age guidance and safety render only if present in data      |
| `/cart`                                       | Working (React context + localStorage)                                                               |
| `/checkout`                                   | UI shell; place-order disabled, nothing submitted                                                    |
| `/about`, `/contact`, `/policies`             | Content placeholders; no invented details or terms                                                   |
| `/admin`                                      | Read-only views of local data; all writes disabled, no auth                                          |

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

### Administrator security flow

The /admin route reuses existing cards, buttons, labels and responsive spacing for email sign-in followed by mandatory verified passkey/security-key enrollment or challenge. Approved storefront layout, branding, colours and original-logo proportions are unchanged. Recovery codes appear once in wrapping text and are never placed in localStorage. Login does not show staff tools until the server confirms the privileged session. Security controls use labels/status/error messages and keyboard-operable native controls.
