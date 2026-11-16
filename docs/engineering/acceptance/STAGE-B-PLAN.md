# Stage B — owner administration: implementation plan (planning only)

Prepared 2026-11-16 for owner approval. **Nothing in this plan has been executed.** No DNS, credentials, Access policies, accounts or deployments were changed. Scope: Afnan Collection acceptance only (Worker `afnan-collection-storefront`, live version `c515b292`, checkout disabled; D1 `11950c2f-…`). **Afnan and Heroine stay separate:** nothing here edits Heroine's application, its policies or the organisation's login methods. Afnan keeps WebAuthn administrator MFA.

## 1. Owner administration architecture (as built, `src/backend/auth.ts`, `src/backend/admin-security.ts`)
Four layers, in order:
1. **Cloudflare Access** (outer gate, organisation `falling-poetry-120a`): today only the service token passes.
2. **App primary sign-in:** Better Auth email OTP (6 digits, 5-minute expiry, 5 attempts, hashed storage). **Sign-up is disabled outside localhost tests**, so only pre-provisioned users can sign in. Codes are sent through Resend only when `RESEND_API_KEY` is set, `EMAIL_FROM=orders@afnancollectionkn.com` and `EMAIL_SENDER_VERIFIED=true`.
3. **Administrator proof:** a WebAuthn passkey or security key per `staff` user.
   - `admin_security` states: `pending → active`, and `recovery`, `disabled`.
   - Challenges expire after 120 s. Admin proofs last 1 hour, with a 15-minute idle timeout and fresh verification for sensitive steps (≤ 5 minutes).
   - Proofs are bound to the primary session, the security epoch and the role. Role change or removal revokes them (triggers).
4. **Recovery:** one-time codes (hashed) issued at first enrolment. Recovery resets keys and old sessions and requires fresh email sign-in plus a new key; it never grants admin directly.

Payment approval, receipt viewing and the review queue require layer 3 with role `admin`; this is unchanged.

## 2. Mailboxes: DNS required for `admin@` and `sales@afnancollectionkn.com`
Current zone (read-only, 3 records, all Resend sending, DNS-only): `send` CNAME, `rsend` CNAME, `resend._domainkey` TXT. **There is no MX record, so nothing at the domain can receive mail.**

**Recommended: Cloudflare Email Routing** (forward to a mailbox the owner already uses). Per [Cloudflare Email Routing docs](https://developers.cloudflare.com/email-routing/postmaster/) and [domain configuration](https://developers.cloudflare.com/email-service/configuration/domains/), enabling it on `afnancollectionkn.com` adds, at the root domain:

| Type | Name | Value |
|---|---|---|
| MX ×3 | `afnancollectionkn.com` | Cloudflare-assigned hosts under `mx.cloudflare.net`, with priorities set automatically. **Take the exact values from the dashboard**; Cloudflare's own pages show different host names. |
| TXT (SPF) | `afnancollectionkn.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all` |
| TXT (DKIM) | `cf2024-1._domainkey` | Cloudflare-generated |

**Then:**
1. Add the owner's existing mailbox as a destination. Cloudflare emails it a verification link, which the owner clicks.
2. Create the routing rules `admin@ → <owner mailbox>` and `sales@ → <owner or sales mailbox>`.
3. Optional, after a week of normal mail: DMARC TXT at `_dmarc`, `v=DMARC1; p=none; rua=mailto:<owner mailbox>`, tightened later.

**Interactions:**
- Email Routing needs exclusive root-domain MX; none exist, so there is no conflict.
- Resend's records are on `send` and `rsend` and the DKIM selector `resend`, so they are unaffected.
- No website records are touched (the zone has none).

**Mailbox ownership check:** the owner sends a message to `admin@` and to `sales@` from another account and confirms receipt in the destination mailbox. Stage B steps 4–6 wait for this.

## 3. Resend sender verification (no credentials created)
Per Resend's [add-a-domain](https://resend.com/docs/add-a-domain), [troubleshooting](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying) and [Cloudflare](https://resend.com/docs/knowledge-base/cloudflare) guides:
- The zone already holds the newer CNAME-style Resend records (`send`, `rsend`) plus DKIM `resend._domainkey`, all DNS-only, as Resend requires.
- **The owner checks in the Resend dashboard** that `afnancollectionkn.com` shows **Verified**. If it shows partial or failed, use "Restart verification"; propagation can take up to 72 hours.
- Resend recommends a sending subdomain. The code is fixed to `orders@afnancollectionkn.com` (the root domain), which Resend supports. Changing it would be a code and owner decision and is **not** proposed.
- **Credential (later, owner-created):** a sending-only Resend API key restricted to that domain. The owner installs it as Worker secret `RESEND_API_KEY` in the Cloudflare dashboard; it is never pasted into chat.
- `EMAIL_SENDER_VERIFIED=true` needs a small workflow PR, like #10: an `acceptance_email` input defaulting to `unverified`, so it is visible at approval.

## 4. Least-privilege Access owner policy (application `00b0cf57` only)
Verified behaviour ([Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), [Policies FAQ](https://developers.cloudflare.com/cloudflare-one/faq/policies-faq/)): Service Auth is evaluated first; then Allow and Block top to bottom, first match wins; deny by default.

| Step | Change | Effect |
|---|---|---|
| 1 | Deny-everyone `4ef44160`: precedence 1 → **3** | No exposure; there is still no Allow, and Access denies by default |
| 2 | **New Allow** at precedence **1**: include `email == admin@afnancollectionkn.com`; require login method `onetimepin` (`382280d1…`); session **4 h** | Only the owner identity can pass |
| 3 | Application `allowed_idps`: `[]` → `["382280d1…"]`; auto-redirect on | The account-member login is not offered for Afnan |

**Unchanged:** Service Auth policy `d4c4d7c0`; organisation settings; login methods (including the PIN method's name, which belongs to the Heroine work); Heroine's application; App Launcher.

**Dependency:** Afnan relies on the organisation's single PIN login method. If it is removed, Afnan owner sign-in fails closed.

**Rollback** (reverse order, read back after each): delete the Allow → deny-everyone back to 1 → `allowed_idps` back to `[]`.

**Verify:**
- no credentials → Access login page;
- service token → 200;
- a non-owner PIN login → refused (needs approval, because it sends a PIN email);
- owner → app sign-in, which still needs the app OTP and WebAuthn.

## 5. Owner provisioning and WebAuthn enrolment sequence
**Preconditions:**
- §2 mailbox confirmed;
- §3 Resend verified, key installed, `EMAIL_SENDER_VERIFIED=true` deployed;
- §4 cutover done;
- the owner supplies an approval reference.

1. Record a D1 bookmark.
2. Generate the SQL with `scripts/admin-bootstrap-plan.mjs` (exact email `admin@afnancollectionkn.com`, approval reference, operator reference). Review it. It creates the user, `admin_security` `pending`, `staff` `admin` and one audit row. Run it on acceptance D1 only.
3. **Owner** opens the acceptance site → Access PIN to `admin@` → app OTP to `admin@` (sent by Resend from `orders@`) → "Enroll passkey or security key" on the owner's own device → **saves the recovery codes offline**.
4. Verify:
   - `admin_security.state='active'`, one credential, `email_verified=1`;
   - admin routes work only with the proof and fail without it;
   - one audit trail.
5. Recommended: enrol a **second** key (backup device) through the same flow.
6. **Rollback:** delete the `staff` row (the trigger revokes admin sessions), then `admin_security` and the user, by ID, after a bookmark. The owner can also use the recovery codes if a key is lost.

**Stage B acceptance tests** (after step 4; owner present):
- approve within the window; reject with a reason and resubmit;
- a duplicate approval is refused; a late payment goes to review;
- the expired, active and cancelled queue grouping;
- a fulfilment-role account (if provisioned) is refused.

Fictional data only. Checkout is enabled for the test window through `acceptance_checkout`, then disabled.

## 6. Renewing hosted testing access and closing the outstanding retest
1. **Owner:** create one Access service token, 24 h, Afnan only (Zero Trust → Access → Service credentials).
2. **Operator:** repoint Service Auth policy `d4c4d7c0` to the new token ID (a policy update, which the operator session can do) and read it back.
3. **Owner:** enter the client secret in the session's secure credential form for host `afnan-collection-storefront.danwakili.workers.dev` (header `CF-Access-Client-Secret`), replacing the expired one. Never in chat.
4. **Operator retest:** health shows `checkoutEnabled:false`; `POST /api/orders` → 503 "Ordering is not enabled"; no token → 401.
5. **Owner:** delete the expired token `8ead1dc6`.

This can be combined with the Stage B window to avoid issuing tokens twice.

## 7. Documentation merge sequence (all merge cleanly into `main` `6bfa8b1` unless noted)
1. **`docs/acceptance-test-plan`** (4 commits; test plan, Stage A results, test-data scripts, this plan): open a PR and merge. It is current and is the reference for Stage B.
2. **`docs/spec-v1-audit`** (1 commit; spec v1.0 audit): open a PR and merge as a dated record. Several "missing" items have since been built (#8, #9); add a one-line note at the top saying so.
3. **PR #4 `docs/production-handover`** (draft; 10 commits on base `2942789`): the chronological handover record through Stage A. Update its description, mark it ready and merge. Earlier entries are historical and later entries supersede them.
4. **PR #1 `docs/project-initialization`:** **no common history with `main`** (built on the pre-upload snapshot), so it cannot be merged. Close it as superseded by the continuity records merged in PR #2.
5. **Branch cleanup** (after 1–3): delete merged branches `ci/acceptance-deploy`, `ci/deploy-artifact-only`, `ci/acceptance-checkout-input`, `feat/bank-transfer-24h`, `feat/payment-receipts` and `fix/logo-path`. The live-history commit `93509da` stays reachable from `main` through the PR #5 merge commit.

## 8. Credential hardening (separate plan; summary — details reported in chat, not in this public repository)
- **Operator Cloudflare token:** currently near-full account scope. Replace it with a scoped, expiring token holding only what acceptance operations use. Then the owner deletes the broad one.
- **Unidentified broad token** (created 2026-08-26, no expiry, last used 2026-11-10): identify its owner and purpose before any change, then replace it with a scoped, expiring token or revoke it.
- **R2 API token:** never used; modified 2026-11-14. The owner confirms the change was theirs.
- **GitHub deploy token:** confirm Workers Scripts: Edit only, this account, expiry set; rotate on expiry.

## 9. Implementation sequence, dependencies and approvals

| # | Step | Depends on | Who | Approval needed |
|---|---|---|---|---|
| 0 | Merge docs (§7 items 1–3), close PR #1 | — | Operator merges / owner closes | Docs merge approval |
| 1 | Renew hosted testing token and run the outstanding retest (§6) | — | Owner + operator | Token creation (owner action) + policy repoint |
| 2 | Email Routing for `admin@` and `sales@` (§2) | — | Owner (dashboard) or operator via API | **DNS/mail change** |
| 3 | Mailbox ownership confirmed | 2 | Owner | — |
| 4 | Resend verified; sending key installed as a Worker secret (§3) | — | Owner | Credential creation (owner) |
| 5 | Workflow PR for `acceptance_email`; deploy with `verified` | 4 | Operator + owner approves run | PR merge + deploy |
| 6 | Access owner cutover (§4) | 3 | Operator | **Access policy change** |
| 7 | Owner provisioning (§5 steps 1–2) | 3, 5, 6 | Operator | **Account provisioning** |
| 8 | Owner WebAuthn enrolment (§5 steps 3–5) | 7 | Owner | — |
| 9 | Stage B acceptance tests | 8, 1 | Owner + operator | Checkout enable/disable deploys |
| 10 | Credential hardening (§8) | after 9 | Owner + operator | Each token change |

## 10. Risks
- **Mail delivery:** forwarding can delay or junk messages. Test both addresses before relying on PINs and OTPs; the codes expire after 5 minutes.
- **Shared PIN login method:** a Heroine-side change to that method breaks Afnan owner sign-in, failing closed. Coordinate changes.
- **Single administrator:** losing the only key leaves recovery codes as the only path. Enrol a backup key and store the codes offline.
- **Public sign-in surface:** none; sign-up stays disabled and Access still gates everything.
- **Data protection:** the acceptance D1 holds no real customer data; keep using fictional data until launch approval.
