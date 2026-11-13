# Initial engineering assessment

Evidence date: 2026-11-13. Inspected upstream main at `24c6c6bf9b99702c95b12bb4cd54e436987c8705` (2026-11-13, “Add Afnan Collection Online storefront source”), following initial commit `ab8aa59`. This assessment adds documentation only; it does not approve deployment or commerce activation.

## Verified architecture and upload

The upload contains application source, shared UI components, routes, design standard, TypeScript/Vite/Vitest/ESLint configuration and bun.lock. No CI workflow or hand-maintained Wrangler configuration is present. The application uses React 19, TanStack Start 1.168.60, Router 1.170.41, Vite 8.1.5, Nitro 3.0.260603-beta and Lovable's Vite wrapper 2.26.5. These individually pinned framework packages should be compatibility-tested together before upgrades.

SSR runs through src/server.ts; src/start.ts supplies error and CSRF middleware. Public pages use local catalog data and TanStack loaders; QueryClient is wired into the router/root. Product data is empty. The admin directly reads local catalog constants; replacing listProducts/getProduct alone will not complete admin integration. Cart state in localStorage is unvalidated, client-controlled input, suitable only for the preview. No real order, auth, inventory, payment or database implementation exists.

## Validation baseline

Environment: Node 24.22.1, Bun 1.4.4. Bun installed as a workspace-local tool; `bun install --frozen-lockfile` succeeded without changing bun.lock. An initial npm exploratory install preceded the frozen install; no npm lockfile was created or committed. A clean frozen install in future CI remains a release gate.

| Check                                        | Result                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Existing Vitest tests                        | 2 files, 5 tests passed (catalog currency/filtering, cart merge, home route match) |
| TypeScript `tsc --noEmit`                    | Passed                                                                             |
| Production `npm run build`                   | Passed; Nitro selected cloudflare-module                                           |
| ESLint `npm run lint`                        | Failed: 201 Prettier formatting errors, 8 warnings in existing source              |
| Source/design/dependency/config preservation | No diff against upload; initialization changes documentation only                  |
| Workerd/browser/live integration             | Not run; no runtime or production compatibility claim                              |

The routing test only matches `/`; it does not render the app. Existing tests do not cover checkout disablement, permissions, persisted-cart validation or commerce. Source inspection confirms checkout prevents submission and disables its order button, with no order/payment endpoints. Baseline formatting should be addressed in a separate, scoped PR rather than obscuring this handoff with a bulk rewrite.

## Cloudflare Workers assessment

**Build-compatible; runtime readiness remains unverified.** The existing wrapper supplies TanStack, React, Tailwind and Nitro plugins and defaults Nitro to `cloudflare-module` outside Lovable. No framework rewrite is required to investigate Workers hosting.

The production build generated `.output/server/index.mjs`, module chunks, `.output/public` assets, `.output/server/wrangler.json` and `.wrangler/deploy/config.json`. Generated Wrangler config uses `main: index.mjs`, an ASSETS binding pointing to `../public`, `no_bundle: true`, ES module rules, `nodejs_compat`, an automatically derived name and compatibility date `2026-11-13`. This generated output is ignored and is not a reviewed production deployment configuration. A date derived from build time is not a stable release contract.

No runtime database driver, filesystem persistence or payment SDK currently blocks the storefront. Browser-only localStorage runs in effects. Optional Lovable telemetry hooks safely do nothing when absent. The SSR error wrapper and module-global last-error buffer need concurrent-request review before handling customer data, to avoid associating another request's error with a response/log.

Next engineering gates (no deployment authorized):

1. Pin the supported Bun/toolchain and explicit Nitro target/compatibility settings; preserve the existing wrapper without adding duplicate plugins. Establish a clean frozen install and CI.
2. Add reviewed deploy configuration with automatic public preview disabled, assets/routing behavior and environment isolation. Do not infer an account or domain from generated defaults.
3. Run Wrangler package dry-run and local workerd smoke tests for SSR routes, assets, unknown products/404, error responses and disabled checkout. Add browser tests for navigation, hydration and cart persistence.
4. Check Worker bundle/CPU limits and current plan entitlements. Test bindings/auth/media in an authorized staging environment before any release claim.

Cloudflare reference points for the follow-up: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/ ; https://developers.cloudflare.com/workers/wrangler/configuration/ ; https://developers.cloudflare.com/workers/runtime-apis/nodejs/ . These are follow-up references; this assessment is grounded in inspected local package code and build output, not a live platform audit.

## Proposed simplest backend (not provisioned or approved)

For a small store hosted on Workers, start with **one TanStack Start Worker, D1 relational storage, R2 product media and Cloudflare Access for a small staff allowlist**. Keep public catalog reads and protected admin APIs in the same application; avoid microservices and customer accounts initially. This minimizes platforms, but staff identity/Access eligibility, limits, backups and business scale must be confirmed. Managed Postgres/auth is an alternative if richer customer accounts, integrations or transactional requirements outgrow D1; there is no existing backend to preserve or migrate.

| Concern    | Proposed implementation                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products   | D1 products, variants/SKUs, categories, image metadata and publication state; public APIs return published fields only; preserve current Product/Variant shapes and integer NGN kobo                                                                     |
| Staff auth | Access protects `/admin` and `/api/admin/*`; Worker independently validates JWT signature/JWKS, issuer, audience, expiry and explicit staff authorization on every protected operation; deny by default, never trust an email header alone               |
| Inventory  | Variant-level authoritative stock plus reservation/movement ledger; nonnegative integer checks, unique SKUs, conditional stock updates and atomic D1 batch/transaction design; test contention and rollback before accepting orders                      |
| Orders     | Server-only order and immutable order-line price snapshots; validate product/variant/quantity, recalculate totals and delivery, use unique idempotency keys and atomically reserve stock; guest checkout proposed                                        |
| Media      | R2 stores images; restricted authenticated upload with type/size validation; only approved product media exposed publicly                                                                                                                                |
| Payments   | One hosted NGN payment provider, selected after merchant/currency/settlement review; server creates references, verifies raw-body webhook signatures and re-verifies provider status/amount/currency/order; deduplicate events and handle expiry/refunds |

D1 does not support an arbitrary long-running application transaction across external payment calls. Use bounded atomic statements/batches for local state, then a separate provider call, followed by idempotent state transitions and reconciliation. A callback/return page never proves payment. Unknown stock (`null`) must not silently authorize sales. Define reservation expiry, release/cancel/refund behavior and retry recovery before implementation. Protect write APIs against CSRF, abuse and unauthorized access; never return customer/order data from public catalog endpoints. Store server credentials in platform secrets, never VITE_*.

Phases: (1) validated hosting foundation; (2) authenticated admin, catalog/media and inventory while checkout stays disabled; (3) tested order/reservation workflow behind a disabled server gate; (4) payment sandbox/reconciliation and business approval; (5) separately authorized live activation. No phase is implemented by this PR.

## Remaining owner/business blockers

- Make the repository private before operational configuration, per owner preference. Visibility remains public; this documentation initialization does not change repository settings.
- Confirm Cloudflare account/plan, staff identities and backend proposal before provisioning; no domains selected or changed.
- Supply real products/SKUs, images, prices and opening inventory, including publication permissions and factual safety guidance.
- Confirm contact/policies, delivery zones/charges, taxes/discounts, stock/backorder rules, cancellations, refunds and customer-data retention.
- Choose payment provider and verify merchant onboarding/settlement requirements; sandbox and live keys must remain separate.
- Resolve baseline lint, establish exact-head CI and local Worker/browser validation. No merge or release is authorized.
