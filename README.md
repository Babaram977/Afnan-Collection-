# Afnan Collection Online

A Nigerian children’s lifestyle store, initially serving Kano. This repository is separate from Heroine Collection, DrippleX and Afnan Homes. GitHub is authoritative; Lovable’s source transfer was one-time, without automatic synchronization.

**Implemented for local/test technical review; not launched or production-ready.** The approved cream/terracotta/pastel/cocoa storefront and Fraunces/Nunito Sans typography are preserved. No real merchandise, prices, stock, reviews, discounts or shipping promises are fabricated.

## Current functionality

- D1-backed active catalog, dynamic categories, age navigation, search, filters, price/name sorting, variants/SKUs, images and stock availability.
- Persistent browser cart plus owner-scoped server copy, with catalog-based rehydration and authoritative checkout validation.
- Email-code customer registration/sign-in/recovery, profiles, saved delivery addresses, account order history and browser-scoped guest order tracking.
- Server-calculated NGN totals, configured delivery zones/fees, idempotent order preparation, transactional reservations, expiry/cancellation and guarded fulfilment.
- Guided owner dashboard (no UUID entry for product/stock tasks): multi-photo upload/previews, main-image ordering, regular/promotional pricing, generated/assigned SKUs, opening stock, safe product deletion and publishing without a code deployment.
- Protected staff dashboard: product/category/variant editing, R2 image uploads, audited stock changes and low-stock view, orders, customers/session revocation, banners, delivery settings, approved policy copy, payment verification/refunds and basic sales totals. Fulfilment staff have restricted access.
- Paystack test adapter with signed webhooks, provider verification, duplicate-event handling, late-payment review and full-refund status reconciliation. Live keys are deliberately rejected. Real Paystack sandbox requests have **not** been verified.
- Worker health endpoint, security headers, origin checks, validated/bounded requests, D1-backed rate limits, structured request IDs, local migrations and automated validation CI. No deployment workflow is included.

Checked-in defaults keep **checkout and payments disabled**. Controlled localhost fixtures explicitly enable simulated ordering. No public deployment, real orders, live payments, production DNS change or remote database/bucket provisioning has occurred.

## Official business details

The owner supplied the address, WhatsApp, social accounts and domain. They are centralized in [`src/lib/business.ts`](src/lib/business.ts), used by the footer, contact/legal sections and SEO, with validated dashboard-editable contact/social overrides stored in Afnan D1. CAC and TIN are recorded as supplied, not independently verified, and displayed only in business information.

The original PNG uploaded in commit `3ef6de5` as `public/brand/IMG_8842(2).png` is now installed at `public/brand/IMG_8842(1).png` through a byte-preserving rename. SHA-256 verified: `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`. The 145,165-byte, 460 × 546 image is used unchanged in the shared header/footer, PNG website icon, Store structured data and homepage social metadata. No crop, recolouring, redrawing or derivative was made; the traced SVG remains reference-only and unused. See [branding handoff](docs/engineering/BRANDING.md).

## Local setup

Use **Node 24 and Bun 1.4.4** (pinned; version-scoped security overrides use Bun lockfile format 3).

```sh
bun install --frozen-lockfile
cp .env.example .dev.vars
# Set a generated AUTH_SECRET in .dev.vars; never commit it.
bun run db:migrate:local
bun run dev
```

`dev` builds then starts the local Worker at `http://localhost:8787`. This is the functional backend development path. `dev:ui` runs Vite for presentation-only work, with no D1 bindings; it is not a working commerce backend. Rebuild after application changes before starting `worker:dev`.

For verified local customer sign-in, configure a transactional email sender through ignored `.dev.vars`. The current adapter supports Resend; sender/domain ownership and actual delivery remain unverified. No password crypto is implemented by the app; Better Auth manages email-code identity and sessions.

For a local-only, **ephemeral fixture store** that needs no email/payment credentials:

```sh
bun run worker:build
bun run dev:fixture
```

This seeds explicitly labelled fictional test merchandise and one fictional delivery fee in an isolated Miniflare database. Use an `@example.com` test address. The terminal accepts `code email@example.com` to read its fixture OTP and `admin email@example.com` after verification to grant a local fixture role. These commands do not contact a real email or payment service and are not public API endpoints. The data disappears when the process ends.

For the persistent local development database, `bun run admin:bootstrap -- verified-email@example.com` grants a role only to an already verified account and prints the matching row. It always uses `--local`. There is no public administrator bootstrap route. Production staff bootstrap requires a separately reviewed account-owned procedure.

## Validation

```sh
bun run typecheck
bun run lint
bun run test
bun run worker:build          # framework build and Wrangler packaging dry-run
bun run test:integration      # actual local Worker + D1 + R2, controlled auth/payment fixtures
bunx playwright install chromium
bun run test:browser          # Chromium at 390, 768 and 1440 px; WCAG checks via axe
bun audit
```

A clean frozen install has been exercised. Existing formatting failures were fixed in a separate formatting commit. Exact results and limits are recorded in [RELEASE-STATUS.md](docs/project-continuity/RELEASE-STATUS.md); local test success does not prove external email/Paystack integrations or production acceptance.

## Architecture and deployment requirements

TanStack Start/Router, React 19, TypeScript, Tailwind 4 and shadcn/Radix UI; Nitro generates SSR modules/assets. A single `afnan-collection-storefront` Worker wraps them with the commerce API. D1 stores application records; R2 handles product images. D1 batches, database constraints and triggers protect stock/order atomicity. Money is integer kobo.

[`wrangler.jsonc`](wrangler.jsonc) is **local preparation**, not a production resource manifest. Its D1 zero UUID is a placeholder; the media bucket is not provisioned. Workers.dev and public preview URLs are disabled; no account/domain routes are configured. `afnancollectionkn.com` is owner-supplied and reported active in Cloudflare; no DNS access or mutation was performed.

Runtime secrets: `AUTH_SECRET`; optional verified `RESEND_API_KEY`/`EMAIL_FROM`; optional `PAYSTACK_SECRET_KEY` **test key only**. They belong in protected runtime settings or ignored `.dev.vars`, never `VITE_*`, source, logs or chat. Use isolated environments and real binding IDs only after reviewing resource ownership. Do not run deployment or remote migrations under this task.

Production blockers include actual email/Paystack sandbox acceptance, real catalog/opening inventory, approved delivery/returns/privacy/retention terms, staff bootstrap, backups/monitoring, account/plan limits, private repository preference and owner launch approval. A full test suite does not remove these blockers.

Read the [owner administration guide](docs/engineering/ADMIN-GUIDE.md), [AGENTS.md](AGENTS.md), the five [continuity records](docs/project-continuity/PROJECT-STATUS.md), [commerce/security guide](docs/engineering/COMMERCE.md) and [UI standard](docs/design/AFNAN-UI-STANDARD.md) before future work.

## License

No license has been declared. Public visibility alone does not grant permission to reuse the code, brand or business assets.

## Final activation handoff

[RELEASE-CHECKLIST.md](docs/engineering/RELEASE-CHECKLIST.md) records the read-only Cloudflare inventory, exact proposed resource names, secure runtime inputs, isolated acceptance gates, backups/rollback and domain-cutover sequence. The intended account and active Afnan zone are now verified; dedicated acceptance D1/R2 were subsequently created with owner approval. The Afnan Worker remains uncreated; no migrations or deployment occurred. R2 lists two other-project buckets. Subscription inspection needs owner Dashboard review because OAuth lacks Billing Read access. See [acceptance runbook](docs/engineering/ACCEPTANCE-RUNBOOK.md) for exact isolated-resource procedures and approval gates. No resources or production routes were changed. The original logo is installed and checksum-verified; see BRANDING.md.

Protected acceptance preparation is documented in [Gate 2 review](docs/engineering/acceptance/GATE-2-REVIEW.md). Acceptance mode disables public registration; the owner-only Access/MFA plan remains unapplied. The existing Zero Trust team is now verified active, while MFA/application configuration remains pending. Mailbox ownership and sender authentication are pending. All routes, checkout and payments remain disabled; no acceptance Worker is deployed. Run `bun run test:acceptance` alongside the existing suites.

Local storefront review: [findings and reproduction](docs/engineering/STOREFRONT-REVIEW.md). After `bun run worker:build`, run `bun run test:storefront` for filter, gallery, option, naira-cart and mobile checks using local fixtures with checkout/payments disabled. Email setup is not needed for this review.
