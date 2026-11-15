# Controlled acceptance test plan: bank transfer, receipts, payment review

Prepared 2026-11-15 for owner approval. **Nothing in this plan has been executed.** Scope: the protected acceptance Worker (`afnan-collection-storefront`, live version `bee7b6a8`, commit `407347d`) and acceptance D1 `11950c2f-…` only. Public checkout, live payments, production, DNS for anything other than the email sender, Heroine Collection and the shared identity provider are out of scope.

## 0. Key constraint found while preparing this plan

**Nobody can sign in on acceptance today.** Sign-in is email-code only (`src/backend/auth.ts`). Sign-up is disabled outside localhost tests (`disableSignUp: !testMode(env)`). Codes are sent only when the Resend sender is verified (`validateSender`: `RESEND_API_KEY`, `EMAIL_FROM=orders@afnancollectionkn.com`, `EMAIL_SENDER_VERIFIED=true`). Acceptance has 0 users and 0 staff. Project rules forbid manufacturing an administrator: the owner is provisioned through the reviewed bootstrap and enrolls their own WebAuthn device.

Separately, **Access admits only the machine service token** (deny-everyone plus Service Auth). A person's browser cannot reach the site.

So testing runs in two stages:
- **Stage A (customer side):** no sign-in needed; guest checkout uses the guest-order cookie.
- **Stage B (admin review):** needs the email sender, owner provisioning and a human Access path first.

## 1. Gate 0: confirm the previous deploy token is revoked (owner, before any further release)

The operator session cannot list or read Cloudflare tokens, so this must be done in the dashboard:
1. Cloudflare → **Manage account → Account API tokens**. Only the current `afnan-acceptance-github-deploy` token (created at the rotation) should be listed for GitHub deploys. **Delete** any other deploy token, including one with the same name but an older creation date.
2. Also check **My Profile → API Tokens** (user-owned tokens) for any token created for GitHub deploys, and delete it.
3. Open the remaining token and confirm: permission **Account → Workers Scripts → Edit** only; account resources = this account only; an expiry is set; "last used" matches deploy run #4 (2026-11-15 ~14:47Z).
4. Optional evidence: **Manage account → Audit logs**, filtered on token deletion, shows the old token's deletion time.
5. Report back "old token deleted at <time>". It is recorded in the handover record.

## 2. Stage A — customer-side acceptance (approval package A)

### A1. Configuration changes (each listed exactly)

| # | Change | How | Reversible by |
|---|---|---|---|
| A1.1 | Allow the deploy workflow to set acceptance checkout explicitly | Small PR to `.github/workflows/deploy-acceptance.yml`: add a required input `acceptance_checkout` with choices `disabled` (default) and `enabled`. It sets `CHECKOUT_ENABLED` and appears in the run name, so the approver sees it. **`PAYMENT_MODE` stays pinned `disabled`**, so Paystack cannot activate; orders are bank transfer only. No other variable changes. | Redeploy with `disabled` |
| A1.2 | Kano test delivery zone | One audited SQL insert into acceptance D1 (`zones`): name `ACCEPTANCE TEST — Kano`, state `Kano`, fee ₦500 (test value, **not a business rate**), active. | Set `active=0` |
| A1.3 | Fictional test product | Audited SQL inserts: one product `ACCEPTANCE TEST — not for sale` (status `active`, category `accessories`, description stating it is a test item), one variant (SKU `ACC-TEST-001`, price ₦2,500 test value, stock 5) and its `inventory_movements` opening-stock row. No images. | Archive the product (`status='archived'`, `deleted_at`) |
| A1.4 | Deploy `407347d` with `acceptance_checkout=enabled` | Hardened workflow; owner approves the deploy step | Redeploy with `disabled`, or `wrangler rollback bee7b6a8` |

A1.2 and A1.3 bypass the admin UI only because no administrator can sign in yet (section 0). The SQL is reviewed in advance, every row is labelled `ACCEPTANCE TEST`, and an `audit` row records each insert. No real product, price or rate is implied.

### A2. Security implications
- Anyone with the **service token** could place test orders; no one else can reach the site. The token is held only in the operator session's secure store and expires 2026-11-16 00:22Z (a new 24 h token is needed for testing after that).
- Customer receipt upload becomes reachable for test orders. Its controls are already verified in CI: ownership, Origin check, rate limit, 5 MB, content checks, private bucket and admin-only viewing.
- No payment provider is contacted (`PAYMENT_MODE=disabled`). No email is sent (sender unverified; notices are recorded as `unconfigured`).
- Expiry testing needs a test order's deadline **shortened** in D1. The deadline trigger refuses extensions only. This is a test-data change on acceptance and is listed in the approval.

### A3. Test steps (operator, over HTTPS with the service token; every response body recorded)
1. **Catalog:** `/api/products` lists only the test product; `/api/zones` lists only the test zone.
2. **Order:** create a bank-transfer order for 2 units.
   - Expect: `payment_method=bank_transfer`, reference `AC-YYYYMMDD-NNNN`, `expires_at` ≈ creation + 86,400 s, total = 2×₦2,500 + ₦500.
   - D1: stock 5 → 3, one `reservation` movement, one `order.created` audit row.
3. **Idempotency:** replaying the same request returns the same order; a changed payload with the same key → 409.
4. **Oversell:** two concurrent orders for the last units → exactly one succeeds. Repeated **20 times**, reported as a ratio.
5. **Receipts:**
   - Upload a valid PNG → 201; R2 object present in `afnan-payment-receipts-acceptance`; not reachable at `/media/…`; customer view shows status only.
   - Invalid and unsafe files → 415 with reasons. Duplicate upload → idempotent. Sixth receipt → refused.
6. **Privacy:** another guest session cannot upload to or read the order (404); `/api/admin/receipts/<id>` → 401.
7. **Expiry:**
   - Shorten one test order's deadline in D1; trigger the sweep with any API read. Expect: status `expired`, stock restored once, `order.expired` audit row, customer status "Expired".
   - Uploading a receipt afterwards → accepted, flagged `afterDeadline`, order stays expired, stock unchanged.
8. **Cancellation:** customer cancels a pending order → stock restored once.
9. **Consistency:** stock = 5 − (units in pending or paid orders); movements sum to the current stock; `quick_check` and the foreign-key check are clean.
10. **Checkout disabled again:** redeploy with `acceptance_checkout=disabled`; order creation → 503.

### A4. Rollback (least destructive first)
1. **Stop ordering:** redeploy `407347d` with `acceptance_checkout=disabled`, or `wrangler rollback bee7b6a8` (both keep the schema and data).
2. **Hide test catalog:** zone `active=0`, product archived. Orders, receipts and audit are kept as test evidence.
3. **Remove test data** (separate approval): record a fresh D1 bookmark; export the test rows (encrypted, outside Git); delete test orders, items, receipts and movements by ID; delete their R2 receipt objects. Never automatic.
4. **Last resort:** D1 Time Travel restore to the bookmark recorded before A1.2 (reverts everything since).

## 3. Stage B — admin review (approval package B, after Stage A)

### B1. Prerequisites (each a separate owner decision)
1. **Email sender:** verify `afnancollectionkn.com` in Resend (add the SPF/DKIM/DMARC records Resend issues; DNS approval), install `RESEND_API_KEY` as a Worker secret, and set `EMAIL_SENDER_VERIFIED=true` through the workflow. Codes are sent only to provisioned users; there is no public sign-up.
2. **Owner provisioning:** run the reviewed bootstrap SQL (`scripts/admin-bootstrap-plan.mjs`) on acceptance D1 for `admin@afnancollectionkn.com`, with your approval reference. It creates a *pending* admin that cannot act until WebAuthn enrolment.
3. **Human Access path** for the owner's browser, without changing the shared identity provider. Options for decision:
   - (a) An Access **Allow** policy for the owner identity using an Afnan-only login method. This needs an IdP decision and is **not** recommended without its own review, because it touches organisation-level settings (the Heroine investigation is the same question).
   - (b) The owner's browser sends the service-token headers, via a vetted header extension or a local proxy. There are no Cloudflare changes, but the owner then holds the token secret.
   - (c) A short-lived Access policy including the owner's current public IP plus a second rule. This is the least preferred.
4. **WebAuthn enrolment** by the owner on their own device, then saving the recovery codes.

### B2. Test steps
Approve within the window, reject with a reason, resubmit, attempt a duplicate approval (refused), approve after the deadline (late review, no stock change), and check the expired, active and cancelled queue grouping. A fulfilment-role account (if one is provisioned) is refused. All decisions appear in `audit`.

### B3. Rollback
Same as A4. Owner access can be revoked by removing the `staff` row, which revokes admin sessions through the existing trigger.

## 4. Not covered by either package
Public checkout, live payments, Paystack, production resources, Moniepoint account-name verification (an owner action before any real customer payment), and any change to Heroine Collection or the shared identity provider.


---

# Stage A preflight report — 2026-11-15T15:03Z

| Check | Result |
|---|---|
| `acceptance_checkout` input | Draft **PR #10** (`86ab9c4`), unmerged. A required choice of `disabled` (default) or `enabled`, validated in both jobs, mapped strictly to `CHECKOUT_ENABLED`, shown in the run name, version message and summary. The step aborts unless `PAYMENT_MODE=disabled`. Simulated: `disabled`→`false`, `enabled`→`true`; `Enabled`, `true` and empty are rejected; name, routes, workers.dev and previews unchanged. |
| Cannot affect production | Fixed target: Worker `afnan-collection-storefront`, acceptance D1 `11950c2f-…`, acceptance buckets, workers.dev only, no routes. No production Worker or D1 exists. The deploy is gated by the `afnan-acceptance` environment (required reviewer, `main` only). |
| Service-token access | Working: with the token, `/api/products` and `/api/zones` return 200; without it, 401. The token (`8ead1dc6`) **expires 2026-11-16T00:22:10Z**, so Stage A tests after that need a new 24 h token, created by the owner and entered through the secure form. |
| Test data seeded (acceptance only) | `test-data/stage-a-seed.sql` (SHA-256 `33fe40be…`), applied 15:02Z after pre-seed bookmark `0000001b-00000000-00005124-26112680495e0a89277f769139ca89f9`. Read-back: zone `ACCEPTANCE TEST — Kano` (₦500, active); product `ACCEPTANCE TEST — not for sale`; variant `ACC-TEST-001` (₦2,500, stock 5); 1 opening-stock movement; 1 audit row; 0 orders; `quick_check` ok; foreign-key check empty. |
| Checkout still off | A hosted order attempt with the token → 503 "Ordering is not enabled". |
| Test data reversible | Proven in the workerd D1 runtime (11/11): the seed is idempotent; a test order totals ₦5,500 and reserves stock; `stage-a-hide.sql` (`aa4a16eb…`) removes product and zone from the storefront, keeps orders as evidence and blocks new orders; `stage-a-remove.sql` (`ffdccab5…`, destructive, separate approval) removes every test row and leaves integrity and foreign keys clean; each step is audited once. Hide and remove were **not** run on acceptance. |
| Previous deploy token | **Not confirmed revoked.** The account audit log is readable but has no record of the rotation (no create or delete after 2026-11-14T23:55Z), which suggests user-owned tokens are logged in the user audit log. The owner should use the dashboard procedure in section 1. |

**Approval requested for Stage A execution:** (1) merge PR #10; (2) dispatch the deploy of `407347d` with `acceptance_checkout=enabled` (owner approves the run); (3) run the A3 tests; (4) redeploy with `disabled` at the end.

---

# Stage B proposal — Afnan-only owner browser access (for approval; nothing changed)

## Current Access configuration (read-only, 2026-11-15T15:00Z)
- **Login methods (organisation-wide):** `cloudflare` (restricted to account members) and `onetimepin` "Heroine Collection — Owner email sign-in" (`382280d1…`). Cloudflare allows **one** one-time-PIN login method per organisation, so an Afnan-only PIN method cannot be created. The existing one only proves an email address; the application policy decides who is allowed.
- **Applications:** Heroine acceptance and App Launcher are pinned to the PIN method. **Afnan acceptance (`00b0cf57`) has `allowed_idps: []`**, meaning every login method is accepted. There is no exposure today, because its only policies are deny-everyone and Service Auth (token `8ead1dc6`).

## Proposal (all changes on the Afnan application only)
1. **Pin Afnan to the PIN method:** set `allowed_idps` on `00b0cf57` to `["382280d1…"]` only, and turn auto-redirect on, so the Cloudflare account-member login is not offered for Afnan. This changes no login method and no other application.
2. **Add one Allow policy** to `00b0cf57`: `include: email == admin@afnancollectionkn.com`, `require: login method == 382280d1…`, session duration **4 h**, precedence ahead of deny-everyone. No other identities, no groups, no IP rules, no bypass.
3. **Keep** the Service Auth policy (token `8ead1dc6`) and the **deny-everyone** policy, so anything that matches neither is refused.
4. No change to the organisation, login methods, App Launcher, Heroine's application or DNS.

## Owner sign-in chain after Stage B
Cloudflare Access PIN to `admin@afnancollectionkn.com` → app email code (Resend, after sender verification) → **WebAuthn** on the owner's device. Three factors, unchanged admin MFA.

## Risks and dependencies
- **Shared login-method object:** Afnan would rely on the organisation's PIN method, which the Heroine work created and named. If the Heroine work deletes or reconfigures it, Afnan owner sign-in stops working; nothing becomes exposed, because Afnan fails closed. Renaming it to something neutral would touch a Heroine-labelled resource and is **not** proposed.
- The owner must control the `admin@afnancollectionkn.com` mailbox; this is still unverified.
- The evaluation order must be verified: after applying, an unlisted email that completes a PIN login is still refused, the service token still works, and requests without credentials are refused.

## Activation (separate approval)
1. Read back and record `00b0cf57`'s app and policies.
2. Apply steps 1–2 above.
3. Read back again.
4. Verify:
   - a request with no credentials → login page, not the app;
   - the service token → 200;
   - an operator-controlled non-owner email completing a PIN login → refused. Only with your approval, because it sends a PIN email;
   - the owner completes a PIN login → reaches the app's own sign-in, which still requires the app code and WebAuthn.

## Immediate rollback
Delete the Allow policy and set `allowed_idps` back to `[]`. That returns the application to exactly today's state (deny-everyone + Service Auth). One API call each, verified by read-back.

## Owner-account provisioning procedure (prepared, not executed)
1. **Preconditions:** the email sender is verified (below); you have confirmed control of `admin@afnancollectionkn.com`; you supply an approval reference for the record.
2. Record a fresh D1 bookmark.
3. Generate the SQL with `scripts/admin-bootstrap-plan.mjs` (exact owner email, approval reference, operator reference). It creates the user, `admin_security` state `pending`, `staff` role `admin` and one audit row. **A pending admin cannot act until WebAuthn enrolment.** Review the SQL, then run it on acceptance D1 only.
4. You sign in (Access PIN → app email code), enrol your security key, and save the recovery codes.
5. Verify: `admin_security.state='active'`, one credential, an admin session works only with the key, and fulfilment-only routes behave as before.
6. **Rollback:** delete the `staff` row (the existing trigger revokes admin sessions), then `admin_security` and the user, by ID, after recording a bookmark.

## Email sender verification procedure (prepared, not executed)
1. You create or confirm a Resend account and add the domain `afnancollectionkn.com`.
2. Resend issues DNS records (SPF TXT, DKIM, return-path, DMARC recommended). Adding them to the `afnancollectionkn.com` zone is a **DNS change needing your approval**. They affect email only, not the website.
3. Once Resend shows the domain verified, create a **sending-only** API key restricted to that domain. You install it as the Worker secret `RESEND_API_KEY` in the Cloudflare dashboard (Workers → afnan-collection-storefront → Settings → Variables → Secret); it is never pasted into chat.
4. `EMAIL_SENDER_VERIFIED=true` needs a workflow change, a PR like #10, because the variables are pinned in the workflow.
5. First real email: one sign-in code to the owner only. Sales notices to `sales@` start only after you confirm that mailbox.
6. **Rollback:** set `EMAIL_SENDER_VERIFIED=false` by redeploying, and revoke the Resend key.
