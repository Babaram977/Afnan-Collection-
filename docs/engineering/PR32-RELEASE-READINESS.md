# Consolidated Afnan administrator release readiness

Prepared 20 November 2026 (Africa/Lagos). Proposal only: no merge, deployment, remote migration, Access change, credential reset or merchandise mutation is performed.

## Consolidation and validation

Application candidate `386b1bcd541bea4ea788ba5a7abd2fa58c808623` contains PR #31 navigation (`9d2c919635df7e190af739fd28572574b6b1c6cb`) and PR #30's compact header (`c609638c4f0438f1d19dda5e0c3933fb1ea5530a`) by ancestry. Neither feature is recreated or cherry-picked. The final preparation commit changes only release/continuity records; application code and migration remain those validated in 386b1bc. Required CI passed on 386b1bc: https://github.com/Babaram977/Afnan-Collection-/actions/runs/44641275660. The PR records the fresh preparation head and its separate required CI outcome.

The picomatch waiver is removed (`exceptions: []`). The unrestricted audit includes development dependencies, has no advisory/severity exclusions and fails closed on unavailable/malformed reports. PR #31's original head remains unmerged because its obsolete exception makes its required check red; this consolidated proposal fixes that gate without overriding it.

## Production read-only preflight

D1 is `afnan-collection-production`, UUID `73ddfc46-34ba-4733-841d-e4819af0b957`. The Worker uses production mode/origin, password authentication and production MEDIA/RECEIPTS buckets. Checkout is false and payments are disabled.

The session schema has no `auth_method` column: migration 0006 has not been applied. Aggregates show 2 sessions, 1 account, 1 matching owner account, 1 administrator role and 1 password credential. No password hash, session token or personal row value was retrieved/exported.

Production currently has **8 product rows and 164 units**, including drafts, plus 8 inventory-history rows and 40 audit records. These totals differ from the older 7/114 baseline. Preserve every record as found; do not delete/reset/reclassify anything to match an earlier count. No business/history writes were performed.

Only user/session schema definitions and aggregate metadata were retained in restricted workspace storage outside Git. Migration 0006 was replayed against that exact schema in a new in-memory database using two synthetic sessions, not copied production rows. Existing session fields stayed unchanged; every representative session received `legacy`; old-code inserts still worked; unsupported methods were rejected; integrity/foreign-key checks passed. Separate local Wrangler migration/replay reported no pending migration on its second pass.

Migration SHA-256: `7369cf4f682bb1e485fc29fa1b9f4dbd9699da035d55de0e9b656a78c08cb26f`.
Restricted schema/metadata snapshot SHA-256: `0fc0a94db965beeb60779ea945851974ca6fe6223e141d13fef0d701107a714b`.
This is a non-mutating production compatibility preflight and local schema replay, not an exported-production-data restoration or remote migration.

## Precise release requirements

1. Required CI must pass for 386b1bc and the fresh final preparation head. Owner reviews/authorizes the consolidated proposal; do not separately merge PR #31 or override its red check.
2. Owner approves migration 0006 for existing acceptance D1. Record its current version/recovery point; apply the reviewed migration once through the ledger. Stop if column/ledger state differs; never blindly replay ALTER or rewrite migration history.
3. After merge authorization and checks, merge PR #32 through existing gates. Record the resulting exact merge SHA; complete main validation and the existing acceptance workflow. No new environment, account or sample remote inventory is needed.
4. Obtain explicit approval for that exact merge SHA's production migration/protected deployment. Refresh production identity/schema/ledger/count checks, save a recovery bookmark/live version, then apply only the approved migration. Preserve credentials, auth secrets, media, history and bindings. The old Worker remains compatible with the extra column.
5. Deploy the exact approved build through the existing owner-controlled workflow, with checkout/payments disabled. **Keep production Access active.** Owner reloads permanent `/admin` and verifies website password sign-in, Store Management/Back to Store, authorized operational access, denials, expiry/logout and recovery. Legacy sessions need one fresh password login, not a password reset or another identity system. Do not mutate genuine merchandise merely to demonstrate login.
6. Only after successful owner native-password verification, obtain separate Afnan-only Access-removal approval. This preparation authorizes none of those remote operations.

## Separate reversible Access-removal proposal

Target only application `c41fff37-8d06-4172-9005-6aa7b9053919` in account `b4e142fe9da84ef204eecda2efe4a730`, covering `afnancollectionkn.com/admin*` and `afnancollectionkn.com/api/admin*`. Do not change shared identity providers, Heroine applications, DNS or other businesses.

The sanitized policy/destination rollback snapshot is outside Git: `/workspace/work/afnan-access-cutover-review/production-access-rollback.json`, directory 0700/file 0600, SHA-256 `4155a9addd279c2a4df532a636fe0dde016933e907c5c1a37931e6ac04afe9a9`. Refresh it immediately before any approved removal. Application removal is a separate authorized action, never a deployment default.

After approved removal, fresh anonymous browsers must reach the branded website login; private APIs/photos must deny unauthenticated requests; one owner password must open management without a Cloudflare challenge. Verify canonical/www/alternate-host behavior and logout/expiry/recovery. Published product photographs remain public through the existing publication-aware route; direct R2 and Worker alternate endpoints stay private/disabled.

If rollback is needed, restore the saved Afnan-only Access protection before reverting to a pre-hardening Worker. Retain the session column and all business/history data. Recreated Access can receive a new application ID; record it and reuse the existing identity provider. Existing approved-operator, one-time password recovery remains available with private credential handling and no public signup or privilege-reset bypass.

See `WEBSITE-ADMIN-AUTH-REVIEW.md` and `ADMIN-RECOVERY-RUNBOOK.md`. Production deployment and Access removal are not currently authorized.
