# Afnan website-only administrator authentication

Prepared 20 November 2026 (Africa/Lagos). **Implementation and local validation only. Production Access remains active. No deployment, remote migration, credential, account, DNS or inventory change is authorized by this review.**

Permanent owner login: `https://afnancollectionkn.com/admin`, existing `admin@afnancollectionkn.com` account. This candidate includes PR #31's management navigation and PR #30's compact header. PR #31's original head cannot be merged while its required audit check is red; this proposed combined release removes the obsolete audit exception rather than overriding that gate.

## Existing controls retained

- Better Auth password sign-in and salted scrypt hashes; no duplicate identity system or new owner account.
- Database-backed, signed primary sessions; HttpOnly, Secure-on-HTTPS, SameSite=Lax, host-only cookies. Seven-day expiry, daily renewal, cookie-cache disabled so revocation/current D1 roles are checked on requests.
- Durable account/IP authentication limits, hourly password-attempt caps, bounded bodies and generic invalid-credential responses.
- Exact Origin and cross-site-fetch checks on mutations; private responses are not cached. Public registration and public password-reset/account-update paths remain disabled.
- Current staff role, credential and disabled-state checks; primary sessions are invalidated on staff removal/role changes. Product, stock, order, photo and management APIs enforce their existing role requirements server-side.
- Controlled recovery uses the existing authorized operator and a 256-bit one-time setup token: only its digest is stored, expiry is 30 minutes, a staff row is mandatory, password reset revokes primary sessions and is audited. Recovery is not a public signup or privilege grant.
- The existing management navigation, same-origin Back to Store, original logo and compact header remain. No checkout/payment activation is included.

## Necessary changes and review findings

**Password-mode session-method gap:** previously any valid primary session for an account with a password could inherit staff access, including an email-code session. `session.auth_method` now records the verified Better Auth endpoint that actually created the session. Only `password` sessions can obtain password-mode administrator roles, including access to legacy MFA-management endpoints; those routes cannot serve as an alternate password-mode entry point. Input fields and Access-style headers cannot set this server-owned fact. OTP/customer sessions remain available for their existing non-administrative purposes. Default WebAuthn mode is retained unchanged.

`0006_session_authentication_method.sql` adds one checked text column to the existing session table, defaulting existing rows to `legacy`. Existing accounts, password hashes, business records, inventory, photographs and session rows are preserved. Legacy/OTP sessions cannot manage the store in password mode; the existing owner performs one fresh website-password sign-in. The `/admin` page presents that form even if another primary session already exists, then opens Store Management directly. There is no second app challenge or requirement to create an acceptance account.

Worker-level canonical-host and HTTPS checks reject unapproved/preview/Workers hostnames even if valid cookies are supplied. `www` remains a redirect to the approved primary origin, not another application. Production workers.dev and previews must stay disabled; no DNS change is needed.

Authentication auditing now records session creation/method, session termination and failed password sign-in, using opaque record references and no passwords, OTPs, setup credentials or session tokens. Existing management/audit history is retained.

**Required audit gate:** Bun returned exit 0 and `{}` at review; the picomatch advisory is no longer reported. Its obsolete exception is removed. The audit reader now fails closed on failed/missing/malformed reports rather than treating transport failures as a clean tree. Regression tests cover those errors. No dependencies or lockfile were changed. Required checks are retained; validation-job timeout is 30 minutes because two prior jobs exhausted 20 minutes during browser installation, without dropping any check.

## Validation evidence

Local validation passed: 40 unit tests; 96 independent-authentication assertions; 12 new browser checks; existing integration 85, password 55, OTP 25, security 77, domain 10, navigation 67, dashboard 87, browser 111, branding 88 and acceptance 12 checks. Typecheck/lint/build passed (10 existing lint warnings), the no-exception audit passed, and local migration application/replay completed successfully. See the PR for the exact proposed commit and CI result. New independent-authentication checks run without any Cloudflare Access credentials and cover anonymous, forged, OTP-only and legacy-session denials; price/stock/order/private-photo authorization; spoofed session-method inputs and Access headers; canonical-host/HTTPS enforcement; CSRF; Secure/HttpOnly/host-only cookies; expiry; logout; metadata-only audit events; schema integrity and unchanged fixture stock. Browser checks cover branded mobile login, another-session-to-password reauthentication, immediate Store Management entry, session retention and logout. Fixture OTPs and media are local only; no real email or customer data is used.

This evidence does not claim a production password login, mailbox verification or hosted account recovery was performed. Those require the owner's existing authorized session and separately approved hosted checks after deploying the reviewed release with Access still active.

Read-only checks also confirm production workers.dev/previews are disabled and the product-media bucket has neither r2.dev public access nor custom public domains. A sanitized Afnan-only Access rollback snapshot is retained outside Git at `/workspace/work/afnan-access-cutover-review/production-access-rollback.json` (directory 0700, file 0600; SHA-256 `4155a9addd279c2a4df532a636fe0dde016933e907c5c1a37931e6ac04afe9a9`). It contains policy/configuration references, not credentials. Production `/admin` and private APIs still redirect to Access.

## Safe transition — separate owner approvals required

1. Review the exact proposed code commit, including retained navigation and additive migration 0006. Obtain approval to merge the combined candidate and to apply the migration to the **existing acceptance database only** before its release workflow runs. This is not approval for production changes or another environment. Record the existing acceptance version/recovery point; apply once through the Wrangler ledger, never by replaying raw ALTER SQL.
2. After required checks pass and the owner approves merging this security proposal, merge through the existing GitHub gates. Record the resulting **exact merge SHA**, wait for main validation and the existing acceptance release workflow, and verify the existing owner-only login and denial tests. No sample remote inventory or duplicate owner account is needed. PR #31's original head is not merged while its required audit check remains red.
3. Obtain explicit approval for that exact merge SHA's **production** migration/deployment. Verify DB `afnan-collection-production` (`73ddfc46-34ba-4733-841d-e4819af0b957`), private product media and existing owner account. Record actual current catalogue counts without resetting to an earlier stated count. Save the live Worker version and D1 recovery bookmark, then apply only the reviewed pending migration. The old Worker remains compatible with the extra session column. Release workflows refuse pending migrations and never apply them themselves.
4. Deploy the approved exact build through the existing owner-controlled production workflow with `ADMIN_AUTH_MODE=password`, checkout disabled, payments disabled and current sender/secrets/bindings preserved. **Keep production Access enabled.** No new auth secret, password reset or environment is required for this normal release.
5. Owner completes the existing Access gate for this controlled verification, then signs in once using the existing store password. Verify Store Management, return navigation, permitted operational actions only within their separately approved data scope, anonymous/other-session denial, expiry/logout and the existing recovery procedure. Do not create sample production inventory or edit genuine merchandise merely to demonstrate login.
6. Only after those checks pass, obtain separate approval to remove the **Afnan production Access application** (`c41fff37-8d06-4172-9005-6aa7b9053919`) covering `/admin*` and `/api/admin*`. Refresh the saved application/destination/policy snapshot immediately beforehand. Do not change shared identity providers, other applications, DNS or Heroine Collection. This review prepares removal and does not execute it.
7. After approved removal, verify `/admin` reaches the branded website login without a Cloudflare redirect; anonymous/private API requests remain denied; one password opens Store Management; canonical/www/alternate-host behavior and recovery remain correct. Checkout and payments stay off.

## Rollback and recovery

Keep the session column and all business data; do not restore an older database or drop authentication/audit records for a code rollback. If removal has occurred, restore the saved **Afnan-only** Access protection before reverting to any pre-hardening Worker, then investigate/roll forward. The shared identity provider is retained, so edge protection can be recreated without modifying other businesses. Record the resulting Access application identity if recreation is required. Owner-approved recovery/session revocation remains available through the existing operator, not a public reset bypass.

No production Access removal or production deployment is permitted until the owner approves the exact release and transition operations. The proposed cutover intentionally removes the separate Cloudflare step for normal daily login only after the application protection has been proved.

## Final production compatibility record

See `PR32-RELEASE-READINESS.md` for the actual production-schema preflight, non-sensitive current counts, local replay evidence and exact release/Access approval requirements. No production data was changed or exported during that validation.
