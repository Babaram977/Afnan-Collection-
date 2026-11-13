# Decisions

Preserve prior decisions and record later changes with reasons. Distinguish owner direction from engineering proposals.

## 2026-11-13 — owner-authorized initialization

- GitHub is the authoritative development source; Codex implements future work. Lovable remains available for targeted design improvements, reconciled manually.
- Preserve the uploaded visual design and docs/design/AFNAN-UI-STANDARD.md.
- Keep checkout/payments disabled. Do not merge, deploy, provision databases or change domains.
- Maintain five separate continuity records per repository using the protocol verified on Heroine Collection's feat/cloudflare-workers branch. Read/reconcile before work, update relevant records at milestones, preserve history, never record secrets/customer data.
- Owner prefers private visibility before operational configuration. This is an outstanding prerequisite, not a completed setting change.
- Money remains integer NGN kobo; server must later own prices and stock.

## 2026-11-13 — engineering proposals (not approved)

One Worker + D1 + R2 + staff Cloudflare Access, with one hosted payment provider later. See INITIAL-ASSESSMENT.md. Workers is under assessment; no production host or backend resources were provisioned. Guest checkout, provider choice, reservation expiry, stock policy, delivery/tax/refund/retention rules and merchant readiness remain unresolved.

## 2026-11-13 — master execution and independent owner administration

These later owner instructions supersede the initial documentation-only scope: implement the working backend, customer and admin flows against local/test resources, push reviewable increments and create draft PRs. Public deployment, production DNS/migrations, real orders, live payments and merging remain unauthorized. Checked-in checkout/payment defaults stay disabled; explicitly gated local fixtures may exercise commerce.

- Select one Cloudflare Worker with D1 and dedicated optional R2. No existing Afnan PostgreSQL connection is present; D1 atomic batches/constraints/triggers cover the bounded reservation workflow with fewer managed services. No Heroine resources are reused.
- Use Better Auth email-code identity on D1 instead of the earlier Cloudflare Access proposal, because customer accounts/recovery are now required. Staff roles remain database-backed and assigned through a privileged verified-owner procedure, never first signup/public claim.
- Owner confirmed **Paystack only**. Implement test-key mode and controlled fixtures; live keys are rejected. Credentials, merchant eligibility and external sandbox verification remain gates.
- Product/stock management must not require developer assistance or UUID entry. Guided photo/options/pricing/opening-stock forms and staff order fulfilment now satisfy the local review workflow.
- Preserve order history through product soft deletion. Promotional prices must be positive and below regular prices; checkout uses the effective server price. Reservations default to 30 minutes pending business acceptance. Refunds do not auto-restock uninspected goods.
- Official business identity/contact/socials were supplied. Central defaults plus validated D1 overrides serve public UI/SEO. CAC BN 4050963 and TIN 24511952-001 remain supplied, not independently verified.
- The supplied gold AC/black flourish raster logo is authoritative and its format is acceptable. Its bytes are unavailable to tools; request the same file, do not redraw/trace/generate a replacement or require a vector. Branding asset installation remains explicitly incomplete.
- Security dependency patches/targeted overrides are covered by frozen-install, lint/build/runtime/browser checks. Pin Bun 1.4.4 for override-capable lockfile format 3. No production-readiness claim follows from fixtures.

## 2026-11-13 — final integration and durable brand memory

- Continue PR #2 from 1667408; preserve the implemented D1/R2/Better Auth/Paystack architecture and approved storefront. No backend rebuild, provider switch or new PR is authorized/needed.
- Preserve the exact owner PNG, filename IMG_8842(1).png, with expected SHA-256 d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1. PNG is already website-compatible. Do not reconstruct from the preview or claim a conversion/checksum/installation before actual bytes are available.
- Implement the request to remember the brand through versioned AFNAN-BRAND-ASSET.json/BRANDING.md and AGENTS.md discovery instructions, not a claim of permanent chat memory.
- Cart mutations wait for restoration, persist locally before navigation, and preserve explicit local removals against a stale server copy. Failed initialization preserves the saved snapshot and shows a recoverable error. This addresses a defect found by customer acceptance testing.
- Cloudflare inspection is read-only. A valid connection does not establish domain visibility, R2 activation or resource readiness. Owner must confirm the correct domain account/scope, review R2 enablement/billing and explicitly authorize any provisioning.
- Keep checkout/payment defaults disabled and live keys rejected. Logo installation, remote administrator creation, paid resources, production migrations, public deployment, DNS cutover and live charging remain gated by the stated inputs/authorizations.

## 2026-11-13 — original PNG integration (supersedes missing-file reports)

The original PNG uploaded in commit `3ef6de5` as `public/brand/IMG_8842(2).png` is now installed at `public/brand/IMG_8842(1).png` through a byte-preserving rename. SHA-256 verified: `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`. The 145,165-byte, 460 × 546 image is used unchanged in the shared header/footer, PNG website icon, Store structured data and homepage social metadata. No crop, recolouring, redrawing or derivative was made; the traced SVG remains reference-only and unused.

Local validation: typecheck, lint and Worker build passed; 111 responsive/browser checks and 88 dedicated branding assertions passed at 320/390/768/1440 px (branding). The branding suite is included in CI. Continue on draft PR #2 / feat/commerce-platform; reconcile exact-head CI from GitHub. No merge, deployment, provisioning or checkout/payment activation occurred. R2 enablement, domain visibility and external acceptance remain separate launch gates.
