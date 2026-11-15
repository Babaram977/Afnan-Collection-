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
