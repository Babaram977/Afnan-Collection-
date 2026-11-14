# Package 1 owner identity, independent MFA and recovery record

Latest selected arrangement and isolation findings: [MEMBERSHIP-ISOLATION.md](MEMBERSHIP-ISOLATION.md). Recovery operator is the existing Cloudflare account administrator; primary TOTP and separate hardware-key backup are selected proposals, not enrollment proof. Strict membership isolation is not yet certified; no invitation is authorized.

Prepared 2026-11-13 (Africa/Lagos), starting from 47b4797 / draft PR #2. This is a verification procedure and evidence template, **not execution approval**. No account enrollment, invitation, authentication challenge, email, policy write, MFA change, remote D1 write, secret, upload, deployment or DNS change was performed.

## Verified facts versus requirements

| Item | Verified read-only/source fact | Still untested or pending |
| --- | --- | --- |
| Existing organization | falling-poetry-120a.cloudflareaccess.com responds successfully | No new organization is required |
| Existing IdP | Cloudflare; ID bf4de15a-2746-4034-952c-01433fbfa3aa | Owner's exact-email Cloudflare login not demonstrated |
| IdP restriction | config.restrict_to_account_members=true; callback is the existing team's /cdn-cgi/access/callback | Do not change shared IdP restrictions without separate approval |
| Account membership | Complete member listing returned one member and **no match for admin@afnancollectionkn.com** | Selected owner is not an accepted member in the inspected inventory; current IdP path is blocked |
| Applications / reusable policies | Both listings return zero | Prepared policy has not been applied; no live coverage claim |
| Independent MFA | Organization response omits mfa_config and mfa_required_for_all_apps | Enablement, allowed methods, enrollment, challenge, expiry and recovery unverified; omitted is not proof of disabled |
| Owner / testers | Owner selected admin@afnancollectionkn.com; owner only | Mailbox control/business ownership unverified; no additional users authorized |
| App authorization | Better Auth session plus current D1 staff row required on each administrative request | No remote owner/admin exists; live denial/role/revocation tests await authorization |

The existing member-only Cloudflare IdP cannot currently authenticate the selected owner because the inspected account inventory had no matching member. Current direction is **do not invite the owner into the shared account**. Review the preferred dedicated Afnan email-PIN IdP with independent MFA instead, without implementing it or changing the shared IdP. No identity-provider change, account provisioning or invitation is approved. Preserve separation from Heroine, DrippleX and Landonova; do not grant infrastructure permissions to solve storefront login.

A personal Yahoo/Gmail identity, alias, forwarded-message screenshot or entered email is not a substitute for the selected exact-email identity. No mailbox, domain registration or company number has been independently verified by this review.

## Supported configuration and intended scope

Current [Cloudflare IdP documentation](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/) confirms existing Cloudflare-user login and optional account-member restriction. Retain the existing provider ID and restriction until a specific alternative is approved.

The [independent MFA mechanism](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/) requires organization-level method availability before application/policy enforcement. Propose TOTP, browser WebAuthn security key or biometrics, with a one-hour MFA interval; Afnan's Access policy/application session is also one hour. Organization-wide enforcement remains off in the proposal. Re-read settings before any write; if global enforcement has changed, stop rather than disable it. Preserve every unrelated organization field and all other services.

The proposed reusable policy's mfa_config requires independent MFA. Do not enable IdP AMR matching as an unreviewed shortcut or assume Cloudflare dashboard two-factor authentication is independent Access MFA. PIV/SSH-only methods are irrelevant to this browser storefront. Supported schema/docs do not prove this owner's successful enrollment.

[access-plan.json](access-plan.json) contains the exact owner-email Allow policy, existing allowed_idps, root application and later Worker-destination placeholder. No everyone/member/domain wildcard Allow, tester policy, bypass, public override or service-token exception. Attach only the actual verified Afnan Worker ID after a separately approved route-disabled upload. The root hostname covers all API/assets/media paths; Worker attachment extends coverage to that Worker. Keep previews disabled. No Worker exists to attach now, and no destination ID may be invented.

## Step-by-step enrollment and challenge procedure — execute only after approval

1. The owner nominated Aisha Idris Muhammad (owner’s wife) as independent business-owner verifier; the existing authorized Cloudflare account administrator is the separate recovery operator. Confirm her willingness and establish a trusted contact method as described below before relying on any future confirmation. She receives no control-plane or storefront privileges; confirm only the recovery operator’s separate authorized recovery path.
2. Do not invite admin@afnancollectionkn.com into the shared account. Review the preferred dedicated Afnan email-PIN IdP plus independent MFA under separate approval; preserve the shared IdP and prohibit personal-email substitution. The older membership procedure is not the selected path. No identity provider, account or policy is created by this record.
3. Independently verify the business owner using the established business handoff plus a previously trusted contact/authorization process. Verify the request using a known channel, not a replacement contact supplied in the same recovery request. Record verifier, method and approval reference privately, without identity-document copies in Git.
4. Under specific MFA/policy approval, configure independent MFA availability on the existing organization, preserving unrelated settings and not requiring it globally. Create only the Afnan policy/app when separately authorized. Read back exact IdP, owner email, required MFA, durations and absence of bypass. No app/Worker is created merely to run this procedure without its own approval.
5. After separate identity-approach approval, owner authenticates the exact business-email identity through the approved Afnan login method at the existing team. The shared Cloudflare IdP remains unchanged; the preferred dedicated email-PIN alternative is not implemented by this record. Proposed enrollment URL is https://falling-poetry-120a.cloudflareaccess.com/AddMfaDevice (not opened or invoked here). Choose an approved authenticator. Owner handles setup QR/secret, TOTP and hardware-key touches directly; no secrets/codes in chat, logs, screenshots or Git. Complete the enrollment confirmation and privately record the device ID/type, not its seed or private key.
6. Enroll a second supported owner-held authenticator where possible (for example a spare security key kept separately); this is the same owner, not another account. Cloudflare currently permits only one TOTP authenticator at a time. Additional authenticator enrollment/removal requires a challenge from an existing factor. Do not assume recovery codes exist; confirm the actual chosen method's recovery behavior.
7. In a fresh browser/session, authenticate the exact IdP user and prove an independent MFA challenge is required and succeeds. Attempt cancel/wrong-factor paths and confirm denial; no application API should be reached with an incomplete challenge. First-factor-only success is a failure. The first enrollment has no prior factor to check, so supervise that initial identity/ownership step.
8. After the separately authorized protected Worker exists, test owner-only denial matrix: anonymous, personal-account identity, wrong email, no MFA, invalid/expired cookies and direct /api/admin, /api/auth, /api/me, /media and static routes. No new tester account is authorized: use an existing non-allowed operator identity only with explicit denial-test consent, or synthetic invalid sessions. Never invite a tester just for a negative test.
9. Record actual challenge/rechallenge timestamps and Access policy/session decisions. Wait for the real one-hour expiry and reauthenticate; do not simulate success by shortening production/global settings. The MFA window is device-bound and evaluated at login; session refresh may reuse a valid global IdP session. Passing means policy reevaluation and independent MFA when due, not necessarily a password prompt every hour. Test an old Better Auth cookie after Access expiry; it must not bypass the edge gate.
10. Keep Better Auth signup disabled and no staff grant. Application mailbox challenge, role assignment and real email belong to their separate approved package. Close the record only with observed evidence; never mark live challenge/recovery passed from local fixtures.

## Nominated verifier — owner-provided decision, not completed verification

| Responsibility | Selected arrangement |
| --- | --- |
| Storefront administrator | admin@afnancollectionkn.com; not provisioned |
| Independent human verifier | Aisha Idris Muhammad, owner’s wife; nominated for sensitive enrollment/recovery identity confirmation |
| Cloudflare recovery operator | Existing authorized Cloudflare account administrator; separate from verifier, no storefront role implied |
| Primary MFA | TOTP, proposed; no enrollment evidence |
| Backup MFA | Separate hardware security key, proposed; no enrollment evidence |
| Authentication alternative | Dedicated Afnan email-PIN identity provider with independent MFA, preferred for further review only |

Straightforward verification procedure (prepared only; no contact made):

1. Confirm Aisha’s willingness to serve through an already trusted channel. Record only consent status/reference in restricted storage when authorized; nomination is not consent.
2. Establish an independently trusted way to contact her. Do not rely solely on new contact instructions supplied in the sensitive request. Do not collect or publish her phone number, identity documents, passwords, OTPs or other personal credentials; no contact address/value is required in this repository or evidence template.
3. Before each sensitive enrollment or recovery, obtain her confirmation of the owner’s identity **and the specific requested action** through that trusted route. A prior confirmation does not approve a different action.
4. The authorized operator records outcome (including refusal/uncertainty), date, operator and approval reference in restricted audit storage. Stop on missing or conflicting confirmation. Her identity confirmation does not itself authorize a technical change or grant any permissions; the operator must also have explicit execution approval.
5. Never treat the nomination alone as successful verification. Willingness, trusted contact establishment and per-action verification all remain pending. Do not contact her or perform a challenge under this local-documentation task.

## Independent owner verification and secure evidence

Use identity-mfa-record.json as a blank template. Put completed evidence only in an owner-controlled restricted audit location; a suggested ignored workspace staging path is .wrangler/acceptance/identity-mfa-record.json, not durable backup. Owner/operator must choose the durable restricted store and retention. Keep only non-sensitive status/references in public continuity docs.

Minimum evidence: exact verified identity and stable IdP/user reference, membership accepted status, independent verifier/method, scope approval reference, MFA method and enrollment/challenge result, UTC timestamps (with Africa/Lagos display if useful), one-hour expiry/rechallenge and denial results, application/policy/audience IDs, session-revocation observation, recovery operator, incident/approval reference and remaining failures. Store no bearer token, cookie, JWT, OTP, password, QR seed, private key or raw identity document. Redact public screenshots. Evidence selection is not evidence completion.

## Lost-device recovery and emergency lockout — no execution now

**Contain first.** A compromised factor or owner session requires a separately authorized incident action. Authorized operator removes/suspends the Afnan owner Allow path or applies a reviewed Afnan-only deny rule and revokes Afnan application's existing Access tokens. Re-read the exact Afnan application/Worker IDs and verify denial externally. Do not delete the Access application to lock it: removing protection can expose the origin. If containment cannot be proven, disable only the Afnan endpoint under its emergency approval. Do not change global enforcement or other projects' routes/policies.

**Revocation is layered.** Access app token revocation prevents current app tokens but an unchanged Allow rule can permit immediate re-login. Preserve the deny condition during recovery. Revoke the user's Better Auth sessions and staff grant with audited, separately approved D1 writes when they exist; edge revocation does not delete application sessions. Per-user Access revocation affects all of that identity's applications and requires explicit broader scope if it would affect other businesses. Clearing a browser cookie/logout alone is not incident containment. Verify old-cookie/API denial after the documented propagation interval; record observed timing instead of promising instantaneous effect.

**Spare device available.** After independent owner verification, owner uses the existing enrolled spare factor to authenticate and remove the lost device, enroll a replacement and pass fresh challenges. Maintain required MFA; do not create a temporary bypass.

**All factors lost.** Independently re-verify owner through the trusted channel and authorize recovery for the exact IdP user/device IDs. A privileged operator can delete the lost Access authenticator(s), then supervise re-enrollment through the same team link. This remote reset is security-sensitive and must be approved/audited. Keep Afnan access denied until replacement enrollment, challenge, expiry/revocation checks succeed. A hostile existing IdP session could race first-factor re-enrollment after a reset: invalidate compromised IdP sessions/secure the owner's Cloudflare account first using an explicitly approved scope; do not reset and reopen access while account compromise is unresolved.

**Operator locked out too.** Use Cloudflare account recovery/support via the established account owner, not an unapproved backup storefront administrator. Record the outage; keep Afnan unavailable. Never disable MFA globally, switch to a personal email, reuse another project's credentials or weaken DNS/protection for recovery.

[Cloudflare authenticator reset/enrollment](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/) and [session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/) document supported mechanisms. Their availability and a successful recovery drill for this account remain untested. Re-fetch current device/session API schemas and exact user/device IDs before any approved reset/revocation; no destructive command is prepared with guessed IDs.

## Access is not an application administrator grant

Source review: src/backend/api.ts actor() obtains a Better Auth session and looks up staff.role by that session's user ID on each request; requireRole rejects no session with 401 and no authorized role with 403. No Access header, cookie, IdP email or MFA claim inserts a user/staff row. Acceptance signup is disabled in src/backend/auth.ts. The local acceptance suite explicitly tries forged Access identity/JWT/cookie headers and verifies administrative denial plus zero staff rows. A separate authenticated-nonstaff denial exists in the integration suite. These prove local application authorization boundaries, not live edge token validation or remote role state.

Any future administrator grant requires separate approval, real application mailbox verification, independent owner confirmation, a narrowly targeted audited staff insert and readback. That operation is excluded from this identity/MFA preparation and is not triggered automatically by Access login/enrollment.

## Remaining decisions and exact approval boundary

Owner decisions still needed:

1. Review the preferred dedicated Afnan email-PIN alternative and independent MFA under separate approval. Do not invite the owner into the shared account or alter its existing IdP.
2. Primary TOTP, separate hardware-key backup and the existing account administrator as recovery operator have been selected. Confirm device availability and the operator's separate control-plane recovery path; confirm nominated verifier Aisha Idris Muhammad’s willingness and independently trusted contact method.
3. Choose restricted evidence location/retention and approve the one-hour challenge/expiry/recovery test procedure and any explicitly scoped existing-identity negative test.

**This Package 1 instruction approves preparation/read-only/local validation only.** Later identity/MFA execution must name the separately reviewed Afnan identity-provider change (if approved), existing-organization MFA prerequisite, Afnan-only policy/application writes, owner enrollment/challenges and scoped recovery/revocation drill. These actions remain unapproved. Do not invite the storefront owner into the shared account; this record does not authorize membership or any outbound challenge.

Migrations/backups, secrets, Worker upload/deployment/route activation, application account/admin provisioning, actual email, sender-domain/DNS changes, checkout/payments/registration and merge remain separately approved operations; they are not included merely by approving an identity/MFA procedure. GATE-3-APPROVAL.md retains the broader independent deployment/sender/email packages, with this identity record as a prerequisite, not a replacement authorization. No execution request is issued before these decisions are settled.
