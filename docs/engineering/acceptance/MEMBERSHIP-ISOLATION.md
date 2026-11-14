# Owner membership isolation review — no invitation authorized

Evidence 2026-11-14, Africa/Lagos; baseline 00bdac5. Owner selected admin@afnancollectionkn.com, existing Cloudflare account administrator as recovery operator, primary TOTP and a separate hardware security key as backup (both proposed, not enrolled). Scope remains Afnan only. The recovery operator gets no storefront staff role from that selection. The owner has nominated **Aisha Idris Muhammad (owner’s wife)** as independent human verifier for sensitive enrollment and recovery. This owner-provided nomination is not completed identity verification or evidence of her willingness/contact validation. Restricted evidence storage and retention remain pending. She receives no Cloudflare, database, application or administrator permissions.

## Read-only findings

Paginated account role inventory: 194 roles; paginated IAM permission-group inventory: 261 groups. Existing resource-group listing returned only the account-wide group. No group, member, invitation or permissions were created/changed.

A role named **Minimal Account Access** exists (role ID 5c35d2bf3a545e6b7560b826c0d23c39). The official role description and live role/permission-group metadata say it can view the account and nothing else. It is account-scoped, not Afnan-resource-scoped. The detailed role API also returns coarse permission flags zone.read=true and organization.read=true, edits=false. These flags alone do not establish the precise domain-list/metadata visibility of an invited user. Do not claim runtime zero cross-project visibility from a role name or from this read-only inventory.

Cloudflare also exposes individual-Worker permission groups, but the Afnan Worker does not yet exist, and granting Worker source/editor or D1/R2 data access is unnecessary for storefront login. Broad Workers/Developer Platform/D1/R2/Access roles and Domain Administrator/Read Only roles are unsuitable for this requirement. Do not add an account-wide read role as an invitation workaround. No existing Heroine, DrippleX or Landonova resource may be selected.

Source: [Cloudflare account roles](https://developers.cloudflare.com/fundamentals/manage-members/roles/), [role scopes](https://developers.cloudflare.com/fundamentals/manage-members/scope/), [Worker role limitations](https://developers.cloudflare.com/workers/authorization/workers/). Per-resource roles exist in the platform; that does not prove a suitable login-only Afnan scope exists before the Worker/application is created.

## Historical minimal-role candidate — do not invite the owner

The earlier review identified **Minimal Account Access** as a conditional candidate, not proof of strict isolation. Current owner direction is **do not invite admin@afnancollectionkn.com into the shared account**. The candidate is retained as historical analysis only; no invitation or account provisioning is prepared or authorized. A member role would still be unrelated to application staff privileges.

This is a candidate for account-metadata-only access according to documented intent, not a proven Afnan-only isolation result. Before approving it, owner must explicitly accept any residual account/domain metadata visibility and resolve the API projection ambiguity with Cloudflare support or a separately authorized scoped verification. No test invite is authorized just to discover permissions.

If later approved, inspect the accepted member's effective direct/inherited policies and verify dashboard/API denial for other-project Workers/code/settings, D1 data/config, R2 buckets/objects, Access configuration, domains/DNS and billing. Tests use the invited user's own context without sharing credentials, never the current administrator's privileged connector. Read-only list success visible to the administrator is not evidence of the invited user's permissions. Abort/revoke the invitation/member under its explicit contingency scope if unwanted visibility appears; do not expand permissions to make the dashboard work. No invitation should proceed while strict zero-other-business visibility remains uncertified.

## Alternative proposed for approval — avoid Cloudflare account membership

Use a dedicated Afnan email one-time-PIN login method with independent Access MFA, limiting Afnan's application allowed_idps to that new provider ID and its Allow policy to the exact owner email. This avoids a Cloudflare account membership/control-plane role entirely. Do not alter the existing shared Cloudflare IdP or its restrict_to_account_members setting.

Cloudflare supports onetimepin IdPs and independent MFA after email authentication. See [one-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) and [independent MFA](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/). Email PIN is the first factor; require the selected TOTP or hardware key as independent MFA. Afnan's Access and MFA intervals remain proposed at one hour. Real mailbox delivery/enrollment and effective enforcement are untested.

The provider is an account-level object: creating it must be separately approved and its effect reviewed against every existing application's allowed_idps settings (especially apps that default to all providers). Current earlier inventory had zero apps; re-read before creation and stop if new apps/defaults would broaden another project's login options. Bind only Afnan and never change other apps without their explicit scope. Do not silently switch the current prepared Access plan to this alternative.

An example creation body, **not sent**, is {"name":"Afnan owner email PIN","type":"onetimepin","config":{}}. Only after explicit approval would the returned provider ID replace Afnan's allowed_idps value. No provider ID can be guessed. Provider creation, real PIN email, MFA prerequisite/policies, enrollment and protected Worker configuration all remain unapproved. Sending a Cloudflare Access PIN is real email and is separate from testing Resend's orders@afnancollectionkn.com transactional sender. It does not authorize SPF/DKIM/DMARC/DNS changes or application email.

## Decision and boundary

Strict isolation remains unproven for Minimal Account Access. Do not invite the owner into the shared account. The dedicated Afnan email-PIN IdP plus independent MFA is the **preferred alternative for further review**, not an approved implementation; the existing shared provider/settings remain unchanged. Aisha Idris Muhammad is nominated, not verified or provisioned. Her willingness and trusted contact method, actual owner verification, restricted evidence storage/retention and future identity/MFA implementation approval remain pending.

No invitation, account provisioning, MFA enrollment, policy/IdP change, email, secret, migration, Worker upload, DNS, merge or deployment was performed. PR #2 remains draft. Checkout/payments/acceptance registration remain disabled. Recovery selection and proposed MFA devices are recorded without granting privileges or promising successful enrollment/recovery.

## Application MFA implementation directive — 2026-11-14

The later owner directive authorizes an application-managed extension to existing Better Auth: verified email plus mandatory WebAuthn, independent of the shared Cloudflare IdP. See ../ADMIN-AUTH-ADR.md and ../ADMIN-RECOVERY-RUNBOOK.md. The dedicated email-PIN IdP remains an unimplemented historical alternative, not the chosen implementation. No shared IdP, membership or Access changes were performed. TOTP is not silently substituted for WebAuthn. Real identity/device/recovery verification, restricted evidence storage/retention and owner-controlled production actions remain pending. Aisha's nomination and separate recovery operator roles are unchanged; neither is newly verified or granted privileges.
