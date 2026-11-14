# ADR — application administrator MFA independent of Cloudflare membership

Status: implemented for review; no deployment, owner enrollment or verified live authentication. Baseline: cef6e6e1a6be3d9aa5b51d450ebb9732920b7bde. Owner's new directive authorizes local implementation, tests, branch push and a review PR.

## Existing architecture and decision

Better Auth email-OTP identities and sessions already use D1 (`user`, `session`, `account`, `verification`). Customers and staff share that primary identity infrastructure. `staff` holds separate admin/fulfilment roles; `audit` stores application events. Every privileged commerce operation uses the existing server-side actor/requireRole checks. No MFA or recovery previously existed. There was no deployed Access application; the shared membership-only Cloudflare IdP cannot admit the selected storefront owner.

Extend this architecture rather than replace customer login. Better Auth remains the primary email factor. SimpleWebAuthn server 14.1.0 verifies registration and signed assertions; browser 14.0.0 handles the WebAuthn ceremony. Require user presence and user verification, exact origin/RP hostname and ES256/RS256. Private authenticator keys remain on the authenticator. No TOTP fallback is introduced: inability to use a supported authenticator denies access instead of downgrading. Platform passkeys and separate hardware security keys are supported; actual device availability and backup enrollment remain owner gates.

New D1 state distinguishes pending, active, recovery and disabled administration. A role, email, forged Access header, customer session or frontend state cannot confer privileged access. The actor grants a role only with verified email, current primary session, active security state, current epoch and a separate valid privileged proof. All existing admin APIs and staff order views inherit this check. Public catalog/media and customer functions remain independent of Cloudflare membership.

Privileged proofs are 256-bit random, hash-only server records in a Secure/HttpOnly/SameSite=Strict `__Host-` cookie on HTTPS (localhost tests use an unprefixed non-Secure cookie). They bind to the primary session ID, user and security epoch, expire absolutely at one hour and after 15 minutes idle. Assertions rotate proofs; enrollment revokes prior proofs. Every request reads current authorization state. Recovery revokes all primary sessions and old keys; role removal/disablement or epoch changes immediately deny privilege. Better Auth's primary session cookie remains HttpOnly, Secure on HTTPS, SameSite=Lax; primary customer sessions retain the existing seven-day policy. Privileged tokens never enter localStorage.

Two-minute random challenges are tied to user, primary session, epoch and ceremony, atomically consumed before verification. Signed counters use compare-and-set. D1-backed IP/identity throttles persist across Worker instances; resend cooldown is 30 seconds, email quotas five/minute and twenty/hour, OTP expiry five minutes/five attempts with hashed storage. Unsafe browser requests require exact Origin and reject cross-site fetches. Only necessary Better Auth HTTP endpoints are exposed; email/password mutation/deletion endpoints remain disabled. Generic login errors and generic send responses prevent account-existence leaks through response content, including provider failures. Delivery failures emit only a fixed diagnostic event. This does not claim constant-time end-to-end network delivery.

Recovery codes are eight independent 256-bit random values, displayed once during first/recovery enrollment, hashed with SHA-256 in D1. High entropy makes an unsalted digest resistant to guessing; codes are not human passwords. Consumption is guarded atomically against the security epoch. Recovery requires fresh email authentication, consumes the entire old code set, removes old keys/sessions and permits only new MFA enrollment. A code alone never creates a privileged session. Audit records contain IDs/events, not challenges, codes, credential responses or recipient/provider bodies.

## Alternatives rejected or retained

- Shared-account invitation or shared IdP modification: forbidden and unnecessary; unrelated businesses remain untouched.
- Separate administrator identity provider/authentication stack: duplicates the existing email/session system and introduces new account/provider operations.
- Email-only staff roles or frontend route hiding: insufficient independent MFA/server authorization.
- TOTP fallback: adds symmetric-secret custody and weaker phishing resistance; not needed for the selected WebAuthn approach.
- Cloudflare Access: remains available as future defense in depth, not silently created, bypassed or removed. This application design is independent of the shared IdP. Owner approval of the final protection/deployment plan remains required; this ADR does not certify an Access gate or replace owner verification.

## Limitations requiring evidence

Automated authenticators and mocked email are engineering evidence only. Real owner identity/mailbox, passkey/security-key enrollment and recovery, Resend sender/delivery, restricted audit retention, private remote media operations, database backup/restore, production secrets and exact hostname remain BLOCKED until independently verified. There is no deployed version to roll back to. A public signup/checkout launch is not implemented or authorized by this security change; those gates remain disabled.
