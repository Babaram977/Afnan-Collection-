# Isolated administrator security validation

Date: 2026-11-14. Baseline cef6e6e1a6be3d9aa5b51d450ebb9732920b7bde; implementation branch feat/isolated-admin-mfa. These results are local engineering evidence, not owner verification, real MFA enrollment, real email delivery or a deployed security assessment. Exact feature-head CI must be checked in the linked PR after push; the prior main CI does not certify this implementation.

| Validation | Local result |
| --- | --- |
| Frozen Bun installation | Passed; existing lockfile preserved/updated for SimpleWebAuthn dependencies |
| TypeScript | Passed |
| ESLint | Passed: zero errors, ten existing Fast Refresh warnings |
| Vitest | 18 tests passed, including four mocked email configuration/delivery tests |
| Production Worker build/package | Passed; original compatibility date/nodejs_compat preserved |
| Actual-resource production-template dry-run | Passed; no upload, routes/worker URLs disabled, checkout/payments/sender-verification false |
| Worker/D1/R2 commerce integration | 85 assertions passed; staff helpers now enroll using actual signature verification, no MFA test bypass |
| Existing acceptance isolation | 12 assertions passed |
| Dedicated administrator security | 77 assertions passed, including HTTPS cookie and production-mode fixture/signup denial |
| Responsive commerce/browser accessibility | 111 checks passed, including virtual CTAP2 verified-key enrollment in the actual administrator UI |
| Original branding | 88 assertions passed at 320/390/768/1440 px |
| Existing storefront review | 181 assertions passed at 320/390/768/1440 px |
| Local migrations | 0001/0002/0003 applied; second ledger apply has no pending migrations |
| Local recovery rehearsal | Export restored into an isolated in-memory SQLite database, three ledger rows/five MFA tables present, foreign-key check clean |
| Dependency security | bun audit: no known vulnerabilities among 670 packages |
| Whitespace/brand preservation | git diff --check passed; original PNG SHA-256 unchanged |

The dedicated runtime tests exercise initial/bootstrap idempotence and rejected inputs; verified-email and fresh-primary enrollment requirements; roles alone denied; required WebAuthn user verification; cryptographic registration/assertions; incorrect origin, signature, expired/consumed challenge and replay denial; hashed proof/recovery values; session rotation, absolute/idle expiry and role/disable/epoch revocation; stolen-proof cross-user denial; client role escalation and CSRF denial; recent MFA for backup enrollment; once-displayed recovery codes; fresh-email recovery, old-key/session/code-set invalidation and new-MFA requirement; per-identity/IP rate limits and resend cooldown; hashed/expired/attempt-limited email codes; no production fixtures/public signup; logout; audit redaction; and migration foreign-key integrity. HTTPS tests assert __Host-, Secure, HttpOnly, SameSite and primary-session revocation. Recovery tests use software authenticators and fictional evidence references only.

Code review also removed the old bootstrap's SQL interpolation of arbitrary email input: only the designated owner plus constrained audit references are accepted. Initial state is pending, never active, and there is no HTTP/remote bootstrap option. Better Auth's unused mutation endpoints are denied, cookies are not cached for authorization, security events omit sensitive values, and role changes/removal revoke sessions through database triggers. Resend failure tests mock fetch and never contact an email service. Recovery-code hashes use high-entropy random codes; email OTP hashing/attempts are handled by the existing maintained Better Auth plugin.

Wrangler resolves dry-run output relative to a supplied config directory. A generated bundle beneath config/.wrangler initially stalled lint under the previous root-only ignore. The ignore now covers nested .wrangler output; generated files remain Git-ignored and are not included in the PR. Final full local validation passed after this fix.

## Evidence limits and owner actions

No real customer data, live payment or actual provider email was used. No remote migrations, secrets, Access/IdP changes, account invitations, DNS changes, Worker application upload or deployment was performed. Cloudflare readback still shows zero Worker versions, disabled worker URLs and no R2 custom domains/managed public access. Local R2 tests do not certify remote upload connectivity. Local export/restore does not certify remote Time Travel entitlement or disaster recovery. Chromium virtual-key tests do not certify real mobile Safari or owner-held devices.

Follow PRODUCTION-AUTH-READINESS.md for all blocked production gates and ADMIN-RECOVERY-RUNBOOK.md for personally completed verification/enrollment. Aisha Idris Muhammad remains nominated only and has no permissions. The recovery administrator's account MFA status still requires owner attention. Approve any protected first-version testing exception explicitly before upload if real hosted verification requires it; do not infer this from conditional public-launch approval. Keep this feature PR unmerged until reviewed.
