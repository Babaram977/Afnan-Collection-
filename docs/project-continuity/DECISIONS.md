# Decisions

## 2026-11-13 — Gate 2 review; stop at Gate 3

Owner supplied admin@afnancollectionkn.com, owner-only testing and proposed orders@afnancollectionkn.com sender; mailbox/business ownership and sender authentication remain unverified. See docs/engineering/acceptance/GATE-2-REVIEW.md and access-plan.json for the current review; they supersede earlier tester/signup assumptions.

Read-only GET reconfirmed the dedicated acceptance D1 is empty and R2 private. Actual DB UUID/private bucket are in the complete ignored acceptance Worker config; dry-run validates bindings. Proposed origin uses the existing danwakili workers.dev subdomain; all Worker routes/previews remain disabled. Access GET reports not_enabled (403/9999). DNS-record listing returned no visible records; no provider-specific DNS values or verified Resend status are available. No generic reconnection is indicated.

Acceptance auth now disables automatic email-OTP signup and core email registration. Ten new assertions cover signup denial, fixture isolation, unauthorized administration and disabled checkout; existing fixture customer flows are retained. The oversized-upload test now streams its payload to avoid a local Undici early-header/EPIPE race while still asserting HTTP 413. Both migrations apply/replay locally with a complete ledger and clean foreign-key check. The full application validation includes 14 unit tests, 85 integration assertions, 111 browser checks and 88 branding assertions; exact new-head CI is reported through PR #2.

Gate 3 still requires explicit approval for remote migrations/data/backup operations, Access enablement/MFA/Afnan-only policies, secrets, protected Worker deployment, owner identity/admin provisioning, sender-domain/DNS verification and real emails. No remote writes or messages were performed in this review. Checkout/live payments/public registration remain disabled; PR #2 stays draft. Lovable/DNS and all other businesses remain untouched. Verify identity through real protected mailbox challenge plus independent business confirmation before granting any role; never treat the entered email as proof.


## 2026-11-13 — owner-approved acceptance storage creation

Owner explicitly approved creation of the named acceptance D1 and R2 only, following the clarification that Worker upload/deployment remains separate. Created afnan-collection-acceptance (DB) and afnan-product-media-acceptance (MEDIA, Standard) in the verified account. GET confirms D1 has zero tables; no migrations or customer data were added. R2 public r2.dev access is disabled and no custom domains exist. Creation succeeded without subscription or billing-setting changes, proving D1/R2 creation permission for these resources. Default placements returned WEUR for D1 and EEUR for R2; no jurisdiction restriction was requested.

Worker afnan-collection-storefront remains planned, not created or reserved. The same six existing Workers retain their pre-action modification timestamps. No deployment, secrets, role assignments, email setup, DNS, production infrastructure or checkout/payment changes occurred. Resource IDs are retained in ignored protected local operator records, not public documentation. Next gates are separately authorized migrations, protected origin/testers, secure email/auth configuration, owner role assignment and controlled Worker upload/deployment; sandbox checkout remains separate.

Application source remains unchanged from the validated 8439b70 baseline (both CI runs 43445561177 and 43445552543 passed). This milestone changes documentation only; verification used actual create responses plus GET resource/public-access/Worker inventory readback. Historical “not provisioned” statements below describe earlier stages and are superseded for these two acceptance resources only.


## 2026-11-13 — corrected account and controlled acceptance preparation

Owner-supplied account/zone IDs were explicitly verified. The intended account has six Workers (four DrippleX, Heroine and Landonova); no Afnan Worker or D1 database. afnancollectionkn.com is active/full and visible. R2 lists dripplex-public and dripplex-uploads, not an empty list; no Afnan bucket. Earlier disabled-R2/missing-domain findings concerned a different connected account and are superseded. Existing services/settings/DNS were not changed.

D1/R2 reads work and returned permission metadata includes edits. New-resource write entitlement/quota remains untested. Subscription GET is blocked by OAuth's lack of support for the Billing Read endpoint (403/code 10000); owner Dashboard billing review is required, not generic reconnection or automatic R2 enablement.

ACCEPTANCE-RUNBOOK.md defines exact isolated names (afnan-collection-storefront, afnan-collection-acceptance/DB, afnan-product-media-acceptance/MEDIA), guarded creation/migration commands, protected-origin procedure, budget/limits, identity/email inputs, rollback and separate production gates. No resources/billing/secret writes, merge, deployment, production migration, DNS or payment activation were performed. Owner must approve provisioning/migrations, budget, protected origin/deployment and administrator assignment; test checkout and production remain separately gated.

Branch/PR reconciliation found no commits after original-logo integration 31d2681, whose two exact-head CI runs 43432962992 and 43432957402 passed. The official original PNG still matches its recorded SHA-256. Full local checks passed again: frozen install, typecheck, lint (zero errors/ten warnings), 14 unit tests, build/dry-run, local migration application/replay, 85 integration assertions, 111 browser and 88 branding checks. Initial integration attempt hit local transport EPIPE; rerun passed unchanged. These are fixture results, not remote email/payment acceptance. Reconcile new documentation-head CI through PR #2 before handoff.


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
