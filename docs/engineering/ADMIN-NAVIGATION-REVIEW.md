# Administrator navigation — 18 November 2026

Based on merged main `da22391` (PR #30), on `fix/admin-store-navigation`.

Admin routes now show the original compact logo, Store Management and Back to Store, with no shopping cart or customer menu. Existing AdminNav Sections navigation remains unchanged, including Products, Inventory, Orders, Categories, Banners and the Settings group. Storefront menus gain Store Management only when the existing `/api/me` endpoint returns the current `admin` role. Guests, customers and fulfilment staff do not receive that storefront link.

The header rechecks role on route navigation, the existing `afnan-auth` event, focus and page restoration. Requests are cancelled when superseded and visibility fails closed. Same-origin links preserve the existing session. No authentication, authorization, backend, database or session implementation was modified. Existing server staff checks and session-revocation triggers still apply to every administrative request; a visible navigation link never grants privileges.

## Targeted validation

- Typecheck and lint passed (0 errors, 10 pre-existing lint warnings).
- Worker build and packaging dry-run passed.
- New `test:admin-navigation`: 67 real-session browser assertions across 320, 390 and 1440 px, including Sections links, no admin cart/menu, guest/customer/fulfilment visibility, session-cookie retention, sign-out, current DB roles, revoked sessions and denied product/stock access. Header Axe accessibility checks passed.
- Existing administrator dashboard: 87 checks passed.
- Existing compact mobile header: 169 checks passed; admin/mobile storefront/desktop header heights remain 65/88/145 px.
- Existing password administrator security: 55 checks passed; administrator security suite: 77 checks passed, including HTTPS cookies and production-mode denial.
- Original PNG SHA-256 remains `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`.

Screenshots use isolated local fixtures, stored in `/workspace/work/afnan-admin-navigation-review`. PR CI runs the new navigation check and uploads `admin-navigation-review`; existing required CI is preserved. No unrelated local commerce suites were repeated.

## Release boundary

A dedicated PR is required. Report its exact commit and normal CI result before any production release. No merge, deployment, database migration, remote inventory write, new environment, Access policy or credential change is part of this task. Product/price/inventory/checkout/payment files and logo assets are unchanged. Preserve the existing production catalogue and official back-office URL `https://afnancollectionkn.com/admin`. Heroine Collection and other businesses are untouched.
