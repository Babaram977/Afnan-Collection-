# Gate 3 numbered approval package — preparation only

Evidence refreshed 2026-11-13, Africa/Lagos. Continue draft PR #2 from ad81bef. This document authorizes no remote action.

## Verified change in readiness

Read-only GET confirms the existing Zero Trust organization falling-poetry-120a.cloudflareaccess.com and one identity provider of type cloudflare (ID recorded in access-plan.json). There are **zero applications and zero reusable policies**. No organization enrollment or generic reconnection is needed. Earlier Access not_enabled findings are superseded; they remain historical observations, not current blockers. No settings were modified.

The organization response did not report mfa_config or mfa_required_for_all_apps. Do not infer MFA is enabled, enrolled, supported by the owner's current identity, or enforced. Exact account/DB/R2 bindings remain as reviewed in GATE-2-REVIEW.md. No Worker upload or remote schema has been added by this documentation update.

Owner remains admin@afnancollectionkn.com; tester scope owner only; proposed From remains orders@afnancollectionkn.com. No mailbox control, business ownership, email-provider authentication or real delivery is established by those selections.

## Precise Afnan-only Access plan

[access-plan.json](access-plan.json) is a review wrapper with separate API bodies. Create one reusable owner policy through /access/policies, then attach its returned ID to one self_hosted root application through /access/apps. Application domain/destination is exactly afnan-collection-storefront.danwakili.workers.dev; every path inherits owner-only protection, including /api/auth, /api/me, /api/admin, /admin, assets and media. Three identical path applications are unnecessary now that all testing is owner only.

The policy allows only the exact owner email. The application restricts allowed_idps to the existing Cloudflare provider ID. Cloudflare account membership or an existing personal Yahoo identity is not a substitute for the selected business mailbox. Before relying on this provider, prove that the owner can authenticate it as admin@afnancollectionkn.com with verified email; if not, stop and review an explicitly approved identity-provider alternative. Do not broaden the email selector or silently add an IdP.

Supported independent MFA schema permits totp, biometrics and security_key. Propose a one-hour MFA interval and one-hour Access session. Independent MFA must be enabled/configured on the **existing** organization before its Afnan policy can require it. If a prerequisite organization update is necessary, GET the full object, preserve unrelated fields and configure only the approved MFA enrollment settings with mfa_required_for_all_apps=false. No global enforcement and no policy changes to another business. Do not disable existing global enforcement if a later GET shows it active: stop and reconcile the changed state before applying this proposal.

Afnan's reusable policy sets mfa_disabled=false and the approved allowed_authenticators/session_duration. Actual enrollment, positive MFA challenge and denial on incomplete MFA must be demonstrated. The Cloudflare IdP's presence is not proof of a usable auth_method=mfa claim; that selector is not the proposed mechanism. Email OTP alone does not satisfy this independent second factor. MFA-enrollment recovery must be owned by the authorized account operator, with independent ownership re-verification and session revocation; do not add an unapproved backup admin.

Default deny; no everyone/domain/member allowances, tester policy, service-token bypass, webhook exception or destination override. No all_workers/all_preview_workers destination. Existing account services must not be attached to this application.

[Cloudflare MFA prerequisites](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/) and [independent MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/) support these settings. API schema was inspected for policy/application and organization fields. This verifies available configuration shape, not successful account-level MFA enrollment or enforcement.

## Secure deployment sequencing

1. With approval package 1 below, verify the exact acceptance DB/name/UUID and migration checksums; capture an approved recovery point/export and apply only its reviewed forward migrations. Confirm ledger and isolation. No fixtures/customer import.
2. Reuse the active team. Configure the narrowly approved independent-MFA prerequisite, reusable owner policy and exact-host application before enabling any origin. Verify returned policy IDs, allowed IdP, one-hour durations, no bypass and default denial. Enrollment and owner-authentication proof remain required.
3. Upload the intended Worker with workers_dev=false, preview_urls=false and routes=[]. Configure only approved protected secrets/settings using the reviewed staged workflow; ordinary secret put/delete may deploy. No endpoint is enabled. Do not use development placeholders or a generated framework config as a shortcut.
4. GET the newly created Afnan Worker's actual ID, verify its identity against the approved account/name, and attach a worker destination to the same application with a full-body update preserving the exact-host destination and policy. The prepared Worker-ID placeholder cannot be executed or guessed. Worker destinations protect associated domains/previews; no public/path overrides or separate more-specific applications may weaken coverage.
5. Re-read coverage before enabling only the approved workers.dev endpoint. Preview URLs remain disabled. Never activate production-domain routes. If Cloudflare cannot associate protection before exposing a route, stop with the Worker inaccessible rather than use an unprotected interval.
6. Perform authorized external Access validation: anonymous, wrong-email, incomplete-MFA, expired-cookie and old app-session requests denied across all API/assets/media routes; only the exact owner with completed MFA admitted. Record Access decision logs without tokens/PII leakage. Afnan Better Auth still requires its own verified session and D1 staff role; Access alone grants no admin privileges.
7. Keep the owner identity absent/unprivileged until the separately approved mailbox/application-email test succeeds. The infrastructure deployment can be verified at the Access boundary while application authentication remains unavailable. Owner operations require package 3 and verified sender readiness; do not claim end-to-end acceptance from a protected landing page.

See [Workers Access coverage](https://developers.cloudflare.com/workers/configuration/cloudflare-access/). Worker-destination attachment is prepared using the current API schema; it has not been applied or tested remotely. Application matching and denial evidence must be collected during approved execution before admitting the owner to application APIs.

## Owner verification method — settle before execution

Two separate checks are required, and neither is replaced by entering an email:

- Independent business verification by the account-authorized operator using the established owner handoff; record verifier and approval reference privately. No identity documents or account passwords in Git/chat.
- Control of admin@afnancollectionkn.com demonstrated by the exact-email authenticated Access identity/MFA and, under the separately approved email-testing package, the application's real single-use email challenge. Any IdP sign-in notification or challenge mail is part of the separately scoped owner authentication operation, not permission for arbitrary outbound mail.

Because acceptance signup is disabled, package 3 must explicitly authorize creating this one initially unverified, nonstaff identity. Only after real code verification and independent business verification may the operator assign admin to that exact verified user ID, record the role grant/audit approval in the same reviewed batch and re-read the result. No public bootstrap and no first-signup role. Existing local-only bootstrap script is not a remote provisioner.

Revocation removes staff membership/application sessions and revokes the owner Access session/allowance, with an audit event. Recovery repeats independent ownership verification and mailbox/MFA controls. If the owner cannot authenticate the selected mailbox through the current IdP or receive application mail, stop before a role grant; do not assign a personal-account substitute.

## Final numbered approvals — independent scopes

**1. Protected acceptance infrastructure/deployment only.** Approve the exact acceptance D1 backup/migrations, existing-team independent-MFA prerequisite (no new enrollment/global enforcement), Afnan-only policy/application, intended Worker upload with routes initially off, protected secret configuration, Worker-destination association, protected-origin activation and Access-denial/MFA tests. No administrator role grant, real application email, sender DNS/provider-domain mutation, production routing, checkout, payments, public registration or merge. If RESEND_API_KEY is unavailable, stop application-email setup and keep it unconfigured; do not fabricate credentials or claim login readiness.

**2. Sender-domain/DNS verification only — separate from package 1.** Owner first supplies protected access to the actual Resend account and its exact generated SPF/DKIM/return-path record requirements plus authoritative-DNS visibility. Present the concrete diff for approval before any provider-domain registration/verification or DNS write. Preserve inbound MX, existing SPF/DMARC and all website records; no apex/www cutover. DMARC policy/report destination needs explicit review. No test email or admin provisioning is implied. If provider verification is already complete, collect evidence instead of adding duplicate records.

**3. Real email and owner-admin acceptance — separate from packages 1/2.** After verified sender readiness, approve named-owner identity pre-provisioning, a bounded verification/test email from orders@afnancollectionkn.com to the owner, real code verification, independent owner check, conditional audited admin assignment and owner-only product/photo/inventory/permission/session/recovery tests. Record delivery and Authentication-Results, not OTP values. No test customer accounts, real customer data, checkout/order creation or payment calls. Other recipients or additional testers require new approval.

**4. Excluded future actions.** Checkout/payment/public-registration enablement, production resources/migrations/deployment, DNS/Lovable cutover and PR merge remain separately authorized future gates. None is included in packages 1–3.

Before requesting execution, settle: owner's exact-email Cloudflare IdP authentication path, independent verifier and MFA enrollment/recovery choice; approved acceptance origin; protected secret availability; recovery/budget limits. Resend sender/domain records and real mailbox delivery remain separate prerequisites for packages 2/3. No new organization enrollment request should be made.
