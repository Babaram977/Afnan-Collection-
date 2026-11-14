# Storefront functionality and mobile review

Evidence date: 2026-11-14 (Africa/Lagos). Started from clean feat/commerce-platform at 78395988366a50519d4442702db093028f182854 / draft PR #2. This review uses the actual built Worker, isolated local D1/R2 and explicitly fictional fixture products. No real email, remote catalog, customer records, production configuration or payments were used. The owner subsequently authorized committing and pushing this reviewed milestone to the existing branch; deployment and merge remain unauthorized.

## Verified defects and focused corrections

| Reproduced behavior | Correction within the existing design |
| --- | --- |
| Mobile menu remains over the page after selecting a navigation link | Existing SheetClose closes the sheet when its link is selected |
| Eight product thumbnails produce horizontal overflow on phones | Gallery thumbnails wrap within the existing container |
| A one-variant product hides its size/colour; only its SKU is visible | Show the existing variant's option label without inventing options |
| A valid long product name overflows listing/detail/cart; narrow cart controls can exceed their space | Allow existing grid/flex children to shrink, wrap long text and wrap quantity controls |
| After hydrated price filtering, Clear filters changes URL/results but old input values remain visible | Search and price fields use current URL state as their value |

Initial pre-hydration navigation appeared to clear filters correctly. The longer hydrated sequence exposed stale price inputs even after URL/results reset; the regression test waits for both before checking the fields. The fixes preserve existing routes, components, colours, typography, layout foundations, backend architecture and original logo. No feature rebuild or new business facts.

## Review coverage and local results

New `bun run test:storefront` suite: **181 assertions** at 320, 390, 768 and 1440 px. It tests homepage dynamic category links; product listing visibility (draft exclusion); category/age/size/query/NGN-range filters; reset and low/high sorting; image loading through the local Worker/R2 route, eight-image gallery and placeholders; single/multiple variant labels; regular/sale prices including kobo fractions; zero-stock Add to cart denial; cart additions/quantity/removal/subtotal/reload persistence; inaccessible draft product/404 and empty catalog; disabled checkout; viewport overflow, browser errors and WCAG A/AA scans. Tablet tests block the external font stylesheet to cover fallback layout. This suite creates zero orders/payments and runs with checkout false/payment mode disabled.

Existing suites also pass on the updated local build:

| Check | Result |
| --- | --- |
| Frozen Bun install | Passed; no dependency/lockfile changes |
| TypeScript | Passed |
| ESLint | Zero errors; 10 pre-existing fast-refresh warnings |
| Unit tests | 14 passed, three files |
| Worker/D1/auth/commerce/security | 85 assertions passed |
| Acceptance registration/admin/checkout guards | 12 assertions passed |
| Existing Chromium workflows/responsiveness/accessibility | 111 checks passed |
| Original-logo delivery/checksum/metadata/layout | 88 assertions passed |
| Production build and Wrangler packaging dry-run | Passed; checked-in checkout/payment defaults remain disabled |
| New focused storefront suite | 181 assertions passed |

Existing order/admin/browser fixtures additionally exercise product creation/photo uploads/variant edits, inventory and owner/staff order workflows with simulated email/Paystack only. Those fixtures explicitly enable local simulated commerce; they do not enable checked-in or remote checkout. No real message or provider request is needed. Test counts describe different assertions/suites, not a production-readiness score.

## Visual and brand inspection

Inspected mobile (320 px) shop/cart and desktop (1440 px) shop screenshots; gallery and other layouts also have scripted checks at every listed width. Full initial-review screenshots are outside the repository at /workspace/work/storefront-review/. They contain fictional test names, deliberately tiny test PNGs and existing placeholders; they are not evidence of real merchandise-image quality. A long uninterrupted fixture name exercises permitted input bounds.

The authoritative original remains public/brand/IMG_8842(1).png, SHA-256 d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1. No logo bytes, palette, font or product-image identity was changed. No fixture product/media was published remotely.

## Reproduce

After installing the locked dependencies and Chromium used by the existing browser suites:

```sh
bun run worker:build
bun run test:storefront
```

Optionally set STOREFRONT_SCREENSHOTS to an ignored/local output directory. Run this suite sequentially with browser/branding suites: all use local port 8787. The validation-only CI workflow now includes test:storefront; exact-head CI is reconciled through PR #2 checks and the final commit handoff.

## Remaining acceptance and launch work

Real owner-approved catalog/images/sizes/prices/opening balances still require business review. Fixture images establish delivery and layout, not real image fidelity. Email remains deferred; protected Access/independent MFA, owner identity verification and verified sender/administrator setup are unresolved. Cloudflare acceptance resources already exist but no remote resource operation, migration, upload, deployment, Access policy/IdP change, secrets, account invitation, DNS or domain connection occurred in this review. Keep live payments/checkout disabled, PR #2 draft and official-domain connection separately approved. Do not change Heroine, DrippleX or Landonova.
