# Approved production migration and protected deployment

Owner authorization, 20 November 2026 (Africa/Lagos): apply migration 0006 through Wrangler's ledger to production D1 `73ddfc46-34ba-4733-841d-e4819af0b957` and deploy application release `38374f8f000849b08b321daad6dfb9f459235eb1`. Keep checkout/payments disabled and Cloudflare Access active until the owner confirms native password login. The previously approved Access removal remains conditional; no owner confirmation is inferred from CI.

## Production operator job

The existing production deployment workflow deliberately never applies migrations, and local Wrangler has no authenticated operator session. The production-only counterpart to the successfully executed acceptance job uses the existing `afnan-production` environment credential securely. It is manual, main-only, repository-owner-only, serialized with production deployment, and fixed to the approved release/account/database. No arbitrary SQL, target or credential input is accepted. Owner dispatch and successful exact-release CI/acceptance are the gates; no extra reviewer setup is required by the owner.

Preparation packages only the exact release's six migration files, with the fixed 0006 SHA-256. The protected job executes no application code and never deploys a Worker. It reads identity/recovery/ledger/schema/integrity before normal `wrangler d1 migrations apply`. Only 0006 may be pending; matching already-applied state is verified without replay. Partial state stops execution. The 8-product/164-unit baseline is enforced, and session identities, account/staff/business/history aggregates, legacy backfill, integrity and foreign keys are checked afterward. Evidence files are restricted, ephemeral and never uploaded; no passwords, session tokens or personal account rows are selected.

## Recovery and deployment boundary

The fresh preflight bookmark and prior Worker version are retained outside Git in `/workspace/work/afnan-production-release-38374f8/preflight.json`. The job records another current bookmark before migration. Retain the additive column during code rollback; never restore older business data automatically after a failed check. The prior production Worker is `0c65154b-73b1-4903-9118-d55b26a57965`.

The approved production workflow must deploy **38374f8**, not this operational-workflow commit. Its existing domain configuration already matches the two current production custom-domain assignments; do not create or move domains or modify DNS. Preserve sender settings (`noreply@afnancollectionkn.com`, unverified), password mode, production DB/MEDIA/RECEIPTS and disabled checkout/payments. Compare DNS/domain assignments and resource bindings before/after, retain Access, and verify the deployed version/message. Cancel any duplicate acceptance build triggered solely by merging operational records; do not deploy another acceptance version.

Local preparation checks passed: Actionlint 1.7.7, YAML/shell/embedded-JavaScript syntax, 17 guard cases using synthetic metadata and actual local SQLite migrations, and `git diff --check`. These do not claim remote migration or deployment success. Final execution results belong in the restricted operator receipt and user report; no new application release is introduced solely for documentation.
