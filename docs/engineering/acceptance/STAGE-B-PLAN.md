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

| Type       | Name                    | Value                                                                                                                                                                                   |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MX ×3      | `afnancollectionkn.com` | Cloudflare-assigned hosts under `mx.cloudflare.net`, with priorities set automatically. **Take the exact values from the dashboard**; Cloudflare's own pages show different host names. |
| TXT (SPF)  | `afnancollectionkn.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all`                                                                                                                                            |
| TXT (DKIM) | `cf2024-1._domainkey`   | Cloudflare-generated                                                                                                                                                                    |

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

| Step | Change                                                                                                                                              | Effect                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Deny-everyone `4ef44160`: precedence 1 → **3**                                                                                                      | No exposure; there is still no Allow, and Access denies by default |
| 2    | **New Allow** at precedence **1**: include `email == admin@afnancollectionkn.com`; require login method `onetimepin` (`382280d1…`); session **4 h** | Only the owner identity can pass                                   |
| 3    | Application `allowed_idps`: `[]` → `["382280d1…"]`; auto-redirect on                                                                                | The account-member login is not offered for Afnan                  |

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

| #   | Step                                                           | Depends on | Who                                   | Approval needed                                |
| --- | -------------------------------------------------------------- | ---------- | ------------------------------------- | ---------------------------------------------- |
| 0   | Merge docs (§7 items 1–3), close PR #1                         | —          | Operator merges / owner closes        | Docs merge approval                            |
| 1   | Renew hosted testing token and run the outstanding retest (§6) | —          | Owner + operator                      | Token creation (owner action) + policy repoint |
| 2   | Email Routing for `admin@` and `sales@` (§2)                   | —          | Owner (dashboard) or operator via API | **DNS/mail change**                            |
| 3   | Mailbox ownership confirmed                                    | 2          | Owner                                 | —                                              |
| 4   | Resend verified; sending key installed as a Worker secret (§3) | —          | Owner                                 | Credential creation (owner)                    |
| 5   | Workflow PR for `acceptance_email`; deploy with `verified`     | 4          | Operator + owner approves run         | PR merge + deploy                              |
| 6   | Access owner cutover (§4)                                      | 3          | Operator                              | **Access policy change**                       |
| 7   | Owner provisioning (§5 steps 1–2)                              | 3, 5, 6    | Operator                              | **Account provisioning**                       |
| 8   | Owner WebAuthn enrolment (§5 steps 3–5)                        | 7          | Owner                                 | —                                              |
| 9   | Stage B acceptance tests                                       | 8, 1       | Owner + operator                      | Checkout enable/disable deploys                |
| 10  | Credential hardening (§8)                                      | after 9    | Owner + operator                      | Each token change                              |

## 10. Risks

- **Mail delivery:** forwarding can delay or junk messages. Test both addresses before relying on PINs and OTPs; the codes expire after 5 minutes.
- **Shared PIN login method:** a Heroine-side change to that method breaks Afnan owner sign-in, failing closed. Coordinate changes.
- **Single administrator:** losing the only key leaves recovery codes as the only path. Enrol a backup key and store the codes offline.
- **Public sign-in surface:** none; sign-up stays disabled and Access still gates everything.
- **Data protection:** the acceptance D1 holds no real customer data; keep using fictional data until launch approval.

---

# Prepared actions awaiting approval (2026-11-16T01:11Z, read-only preparation)

## P1. Cloudflare Email Routing for `afnancollectionkn.com` (DNS/mail change)

Read-only status: Email Routing **unconfigured**, 0 destination addresses, 0 active rules. The zone has no MX and no root SPF.

Cloudflare-computed records (`GET /zones/…/email/routing/dns`):

| Type | Name                                        | Value                                        | Priority |
| ---- | ------------------------------------------- | -------------------------------------------- | -------- |
| MX   | `afnancollectionkn.com`                     | `route1.mx.cloudflare.net`                   | 3        |
| MX   | `afnancollectionkn.com`                     | `route2.mx.cloudflare.net`                   | 100      |
| MX   | `afnancollectionkn.com`                     | `route3.mx.cloudflare.net`                   | 86       |
| TXT  | `afnancollectionkn.com`                     | `v=spf1 include:_spf.mx.cloudflare.net ~all` | —        |
| TXT  | `cf2024-1._domainkey.afnancollectionkn.com` | Cloudflare DKIM key (2048-bit RSA)           | —        |

- **Resend compatibility:** there is no existing root SPF or MX to merge or remove. Resend uses `send` and `rsend` (CNAMEs) and `resend._domainkey`, with no overlap. DMARC alignment for Resend mail comes from its DKIM on `afnancollectionkn.com`.
- **Owner steps** (dashboard → the zone → Email → Email Routing):
  1. Enable it, which adds the records above.
  2. Add a destination address (the owner's existing mailbox) and click Cloudflare's verification email.
  3. Create the rules `admin@afnancollectionkn.com → destination` and `sales@afnancollectionkn.com → destination`.
- **Verify:**
  - the five records exist;
  - routing status `ready`;
  - the destination is `verified`;
  - test messages to `admin@` and `sales@` arrive.
- **Rollback:** disable Email Routing, which removes its records; nothing else in the zone changes.

## P2. Renew hosted test access and close the outstanding retest

1. **Owner:** create an Access service token, 24 h, named `Afnan acceptance automation`.
2. **Operator:** `PUT /accounts/b4e142fe…/access/apps/00b0cf57…/policies/d4c4d7c0…` with exactly `{"name":"Afnan acceptance automation only","decision":"non_identity","include":[{"service_token":{"token_id":"<NEW_ID>"}}],"exclude":[],"require":[],"precedence":2,"session_duration":"1h"}`. Read back.
3. **Owner:** enter the new client secret in the session's secure credential form for host `afnan-collection-storefront.danwakili.workers.dev`, header `CF-Access-Client-Secret`.
4. **Operator retest:**
   - health shows `checkoutEnabled:false`;
   - `POST /api/orders` on the hidden test catalog → **503 "Ordering is not enabled"**;
   - no token → 401;
   - logo 200 with the approved checksum.
5. **Owner:** delete the expired service token (`8ead1dc6…`).

- **Rollback:** repoint the policy to nothing by deleting the new token; Access then refuses all requests (today's state).

## P3. Least-privilege replacement for the operator Cloudflare token

**Owner creates** (dashboard → Manage account → Account API tokens → Create → Custom) a token named `afnan-operator-acceptance`, **expiring in 30 days**, with:

| Scope                             | Permission                                    | Used for                                            |
| --------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Account `b4e142fe…`               | Workers Scripts **Read**                      | Live version, bindings, deployments                 |
| Account                           | D1 **Read**, D1 **Write**                     | Migrations, verification queries, test-data scripts |
| Account                           | Access: Apps and Policies **Read**, **Write** | P2 repoint, P5 cutover and rollback                 |
| Account                           | Access: Service Tokens **Read**               | Token expiry checks (metadata only)                 |
| Account                           | Workers R2 Storage **Read**                   | Receipt object verification                         |
| Account                           | Audit Logs **Read**                           | Change evidence                                     |
| Account                           | Email Routing Addresses **Read**              | P1 verification                                     |
| Zone `afnancollectionkn.com` only | DNS **Read**, Email Routing Rules **Read**    | P1 verification                                     |

**Deliberately excluded:** API token management, billing, account settings write, Access organisation and login-method write, Workers Scripts write (deploys go through GitHub), R2 write, DNS write, every other zone, and every other product.

**Cutover:**

1. The owner enters the new token in the session's secure credential form for `api.cloudflare.com`, replacing the saved one. The old token stays valid until revoked.
2. The operator verifies each row above with a read-only call. It also confirms a **forbidden** call fails: listing account API tokens must return 403.
3. Only then does the owner revoke `Afnan-Collection-Claude-Acceptance`.
4. If any needed call fails, the owner adds only that permission; the old token is not revoked until all pass.

## P4. Owner Access policy (application `00b0cf57`; change only after P1 is verified)

**Current:** precedence 1 deny-everyone (`4ef44160`); precedence 2 Service Auth (`d4c4d7c0`); `allowed_idps: []`.

1. `PUT …/policies/4ef44160…`: same body, precedence **3**.
2. `POST …/apps/00b0cf57…/policies`: `{"name":"Afnan owner (PIN login, WebAuthn in app)","decision":"allow","include":[{"email":{"email":"admin@afnancollectionkn.com"}}],"require":[{"login_method":{"id":"382280d1-e52c-49f9-8f11-f1a7936da206"}}],"exclude":[],"precedence":1,"session_duration":"4h"}`.
3. `PUT …/apps/00b0cf57…`: **full current application body**, read back first, because this call replaces the whole configuration. Change only `allowed_idps: ["382280d1-…"]` and `auto_redirect_to_identity: true`.

- **Evaluation after the change:** Service Auth (token) first → Allow owner (1) → deny everyone (3); anything else is denied by default.
- **Service token:** unaffected; Service Auth is evaluated before Allow and Block.
- **No exposure window:** after step 1 there is no Allow policy, so Access denies by default.
- **Rollback (reverse):** delete the Allow → deny-everyone back to precedence 1 → application body restored from the read-back (`allowed_idps: []`).
- **Verify:**
  - no credentials → Access login page;
  - service token → 200;
  - an operator-controlled non-owner PIN login → refused (separate approval, because it sends a PIN email);
  - owner → reaches the app sign-in, which still needs the app email OTP and WebAuthn.

## P5. Owner administration protection (unchanged requirements)

- Email verification: Access PIN plus the app email OTP to `admin@`. No public sign-up.
- **WebAuthn mandatory** for every admin action; payment approval and receipt access need an active admin proof.
- **Backup key:** the owner enrols a second key during the provisioning session.
- **Recovery codes:** shown once at first enrolment; the owner stores them offline (paper or password manager), never in chat or email.
- Any admin who loses all keys uses a recovery code, which resets keys and sessions and requires fresh email sign-in plus a new key.

## P1 update — adding `support@afnancollectionkn.com` (2026-11-16T01:13Z, read-only)

**Status:** `support@afnancollectionkn.com` is **not a working mailbox**. Read-back shows no MX record, no root SPF, Email Routing **unconfigured**, and only a disabled placeholder catch-all (action `drop`). No address on the domain can receive mail yet.

**How Email Routing works** ([routing rules and addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/), [route emails](https://developers.cloudflare.com/email-service/get-started/route-emails/)):

- It forwards each custom address to **one verified destination mailbox**. Rules stay disabled until the destination is verified.
- It **holds no mailboxes**, so `support@` cannot be the inbox for `admin@` and `sales@`.
- It **cannot send or reply from the domain**; replies go out from the destination address.
- Chaining one custom address to another on the same domain is not documented, and is not used.

### Option A (recommended; smallest change): three direct forwards, no chain

| Custom address                  | Action                      | Destination                           |
| ------------------------------- | --------------------------- | ------------------------------------- |
| `admin@afnancollectionkn.com`   | forward                     | `<owner's existing external mailbox>` |
| `sales@afnancollectionkn.com`   | forward                     | `<same or a sales mailbox>`           |
| `support@afnancollectionkn.com` | forward                     | `<same or a support mailbox>`         |
| catch-all                       | **stays disabled** (`drop`) | —                                     |

- **No loop is possible:** every destination is outside `afnancollectionkn.com`, and no address forwards to another address on the domain. Each rule is checked to have a destination with a different domain before it is enabled.
- **The destination must be verified first:** Cloudflare emails it a link, and the owner clicks it. Until then the rules stay disabled.
- **Limit:** customers who write to `support@` receive replies from the destination address, not from `support@`.
- DNS: the five Cloudflare records listed in P1, with no other zone changes.

### Option B: a real inbox you can reply from as `support@` (hosted mailbox provider, e.g. Zoho Mail or Google Workspace)

- The provider's MX records go on the root domain **instead of** Email Routing; both cannot own the root MX.
- `support@` is a real mailbox, and `admin@` and `sales@` are aliases or extra mailboxes at the same provider.
- SPF must **combine** the provider and anything else sending as the root domain. Resend sends from `send.afnancollectionkn.com` and signs with `resend._domainkey`, so it needs no root SPF entry.
- Costs and setup are the provider's; all are owner decisions.

### Application impact (either option)

- Sign-in codes are sent by Resend **from** `orders@afnancollectionkn.com`. Receiving `admin@` is what matters for the owner PIN and OTP.
- Payment-review notices are addressed **to** `sales@` (`business.salesEmail`).
- `support@` is **not referenced in the application**. Publishing it as a customer contact (footer or contact page) would be a separate content change and is not part of this plan.

### Verification before any forwarding is relied on

1. The destination is shown as verified in Email Routing.
2. Each rule is enabled with exactly one destination, outside the domain.
3. A test message from an outside account to each of `admin@`, `sales@` and `support@` arrives once, in the expected destination, and not in spam.
4. The catch-all is still disabled.

**Rollback:** disable the rules, or disable Email Routing (which removes its records).

**Owner decision needed:** Option A or B, and the destination mailbox address(es). The address is entered in the Cloudflare dashboard by the owner; it is not needed in chat.

## P1 revision — `support@` reported active by the owner; hosting check (2026-11-16T01:15Z, read-only)

**Findings:**

- The zone `afnancollectionkn.com` is **active, type full, on Cloudflare nameservers** (`jake.ns.cloudflare.com`, `molly.ns.cloudflare.com`) since **2026-11-13T01:45Z**. **Cloudflare is therefore the authoritative DNS**: what is in this zone is what the internet sees.
- **Previous nameservers:** `ns1.qservers.net`, `ns2.qservers.net` (registrar: Gransy).
- The Cloudflare zone has only 3 records, all Resend sending (`send`, `rsend`, `resend._domainkey`, added 2026-11-14). **There is no MX record, no root SPF and no root A/AAAA record.**
- **Consequence:** with no MX, and no root address record to fall back to, outside senders cannot deliver to any `@afnancollectionkn.com` address. If `support@` is hosted with a provider whose MX records lived at `qservers.net`, **those records were not carried over at the 13 Nov nameserver change, and inbound mail from outside has probably failed since then.** Logging in and sending can still work, which can make the mailbox look healthy.
- **Limit of this check:** the operator sandbox has no public DNS resolver, and public DNS-over-HTTPS is blocked, so the public view could not be queried independently. The Cloudflare zone being authoritative and active makes the conclusion strong but not tested end to end.

**Owner checks (no changes):**

1. **Inbound test:** from a personal account on another domain (for example Gmail), send a message to `support@afnancollectionkn.com`. Does it arrive? Does the sender get a bounce ("domain not found" or "no MX")?
2. **Provider:** where do you log in to read `support@`? The webmail address or app tells us the provider: registrar mail at Gransy/Subreg, Zoho, Google Workspace, Microsoft 365, Hostinger or another.
3. **Old records:** if available, the DNS records previously set at `qservers.net` / the registrar panel, especially MX, SPF (TXT `v=spf1 …`), DKIM and any autodiscover records.

### Compatibility decision

- **If `support@` is hosted by a mail provider (expected):** **Cloudflare Email Routing is not compatible** with it. Email Routing requires exclusive control of the root MX, and enabling it would route all domain mail away from that provider. **Do not enable Email Routing.**
- **Recommended instead: restore the provider's records in Cloudflare DNS and use the provider's own aliases.**
  1. Add the provider's **MX** records exactly as the provider publishes them, plus its **DKIM** and any required verification or autodiscover records, all **DNS-only** (not proxied).
  2. **SPF (root TXT):** a single record for the provider, `v=spf1 include:<provider> ~all`. Resend needs no root SPF entry: it sends from `send.afnancollectionkn.com` and signs with `resend._domainkey`. If Resend is later added at the root, it must be **merged** into the same record, never added as a second SPF record.
  3. In the provider's admin panel, create **`admin@` and `sales@` as aliases (or forwarders) of the `support@` mailbox**. Delivery stays inside one provider, so there is no external hop.
  4. **Loop check:** `support@` must not forward back to `admin@` or `sales@`. If `support@` forwards to another mailbox, that destination must be outside `afnancollectionkn.com`.
  5. Optional later: DMARC at `_dmarc`, starting at `p=none`.
- **Only if `support@` turns out to have no provider** (it cannot actually receive): Email Routing Option A from P1 applies, with `support@` forwarding to an existing external mailbox and `admin@`/`sales@` forwarding **directly** to that same external mailbox, not through `support@`.

### Preserved and out of scope

- **Preserved:** the Resend records (`send`, `rsend`, `resend._domainkey`); no root SPF conflict exists today.
- **Out of scope:** Heroine Collection's domain and mail.

### Verification after any change (approval required first)

- The MX records match the provider.
- One SPF record only.
- Outside test messages to `support@`, `admin@` and `sales@` each arrive once in the `support@` mailbox, not in spam.
- Resend sending still verifies.

## P1 investigation — did `support@` have working hosted mail before 13 Nov? (2026-11-16T01:30Z, read-only)

**Cloudflare account audit log, zone `afnancollectionkn.com`:**

| Time (UTC)          | Event                                                                          | Actor  | Meaning                                                                                          |
| ------------------- | ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| 2026-11-13 01:34:03 | zone created                                                                   | user   | Domain added to Cloudflare                                                                       |
| 01:34:06            | `dns_records scan`                                                             | user   | Cloudflare queries the **previous** DNS host (`ns1/ns2.qservers.net`) to import existing records |
| 01:45:26–01:47:41   | 4 DNS records created then deleted, interleaved with `certificate_pack` events | system | Cloudflare's own TLS-certificate validation records, not imported records                        |
| 01:45               | zone **active** on Cloudflare nameservers                                      | —      | Cloudflare becomes authoritative                                                                 |
| 2026-11-14 14:28:45 | 3 records created                                                              | user   | Resend `send`, `rsend`, `resend._domainkey`                                                      |
| (none)              | no other record creation or deletion                                           | —      | —                                                                                                |

**Conclusion (strong, not certain):** the import scan run against the old DNS at 01:34 on 13 Nov **found no records to import**: no MX, no root A/AAAA, no SPF. It is therefore unlikely that a working inbound mail configuration was dropped by the migration. More likely the domain had **no inbound mail (MX) set up before 13 Nov either**.

**What remains possible:**

- A mailbox for `support@` may exist at a provider (for example a registrar mail plan or Zoho) that was **never connected** through MX records; it could send but not receive outside mail.
- The scan could have missed records. That is uncommon for the root MX, which the scan always queries.
- The registrar panel at Gransy/Subreg may still hold an old zone that is no longer used.

**The owner's answer decides:** did `support@` ever **receive** a message from an outside sender before 13 Nov, and where is it opened (webmail or app)?

### Comparison: restore existing hosting vs new hosted mailbox

|                          | Restore existing provider (if `support@` already exists somewhere)                   | New hosted mailbox (e.g. Zoho Mail, Microsoft 365, Google Workspace)                    |
| ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Applies when             | You can log in to an existing `support@` mailbox at a provider                       | No existing mailbox, or the existing one is unsuitable                                  |
| DNS changes (approval)   | Add that provider's MX + DKIM (+ verification) records; one root SPF for it          | Same set for the new provider after it verifies domain ownership (usually a TXT record) |
| `admin@`, `sales@`       | Aliases of `support@` inside the provider                                            | Aliases (or extra mailboxes) of `support@` inside the provider                          |
| Reply as `support@`      | Yes                                                                                  | Yes                                                                                     |
| Cost                     | Existing plan                                                                        | New subscription (free tiers exist with limits)                                         |
| Data                     | Keeps any existing mail history                                                      | Starts empty                                                                            |
| Risk                     | Low, if records come from the provider's own setup page                              | Low; new account setup and domain verification                                          |
| Resend                   | Unaffected: Resend uses `send`/`rsend`/`resend._domainkey`; no root SPF entry needed | Unaffected (same reason)                                                                |
| Cloudflare Email Routing | **Not used**; it would conflict with the provider's MX                               | **Not used**                                                                            |

**Not recommended:** enabling Cloudflare Email Routing for `admin@` and `sales@` while `support@` lives at a provider. Email Routing takes exclusive control of the root MX, so it would cut the provider off.

**Next owner inputs:**

1. Whether `support@` ever received outside mail before 13 Nov.
2. Where it is opened (provider).
3. An inbound test from an outside account today.

The exact DNS records will then be taken from that provider's own setup page and presented for approval. **No DNS, MX, SPF, DKIM, Resend or Access changes until then.**

---

# Revision 2026-11-16: owner launch mandate (supersedes the email-routing dependencies above)

**Owner decisions:**

- Email forwarding and Cloudflare Email Routing are **cancelled**.
- The owner controls the required mailboxes on QServers.
- Email restoration is closed (Stage 2 DNS published, record IDs in `EMAIL-RESTORATION-QSERVERS.md`).
- Launch with **bank transfer only**; card payments (Paystack) stay disabled.

**Removed:** P1 (Email Routing), the P1 updates and revisions, §2 forwarding, sequence steps 2–3 and the forwarding risk. The `admin@` mailbox exists, and receiving PINs and OTPs there no longer depends on any forwarder.

**Owner administration moves to production.** WebAuthn binds passkeys to the hostname in `APP_ORIGIN` (`rpID`, `src/backend/admin-security.ts`). A passkey enrolled on the acceptance workers.dev host would not work on `afnancollectionkn.com`. The owner is therefore provisioned and enrolled once, on the production Worker at `afnancollectionkn.com`, while the whole host is behind an owner-only Access policy. Acceptance stays a closed test environment.

**Production resources (created 2026-11-16, separate from acceptance):**

| Resource      | Name                                | ID / location                                                                                                                                                                                  |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1            | `afnan-collection-production`       | `73ddfc46-34ba-4733-841d-e4819af0b957`, WEUR; migrations 0001–0005 applied; schema identical to acceptance; 11 categories, no products, zones, orders or users; Time Travel bookmark available |
| R2 (media)    | `afnan-product-media-production`    | WEUR, private (no r2.dev, no custom domain)                                                                                                                                                    |
| R2 (receipts) | `afnan-payment-receipts-production` | WEUR, private                                                                                                                                                                                  |
| Worker        | `afnan-collection-production`       | created by the first run of `deploy-production.yml`; workers.dev off, no routes                                                                                                                |

**Revised launch sequence:**

| #   | Step                                                                                                                                                                                                                                                             | Who                              | Gate                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------ |
| L1  | Merge the production workflow PR; create GitHub environment `afnan-production` (owner reviewer, `main` only) with secret `CLOUDFLARE_API_TOKEN`                                                                                                                  | Owner                            | PR approval                    |
| L2  | First production deploy (checkout disabled, sender unverified); generate a production-only `AUTH_SECRET`                                                                                                                                                         | Operator, owner approves the run | Deploy approval                |
| L3  | Resend sending key saved as Worker secret `RESEND_API_KEY` on `afnan-collection-production`; redeploy with `email_sender=verified`                                                                                                                               | Owner (key), operator            | Owner action                   |
| L4  | Attach `afnancollectionkn.com` and `www` to the production Worker behind a new owner-only Access application (allow `admin@afnancollectionkn.com`, deny everyone else)                                                                                           | Operator                         | **DNS + Access approval**      |
| L5  | Owner bootstrap (`scripts/admin-bootstrap-plan.mjs`, exact owner email); owner signs in, enrols a passkey plus a backup passkey, saves recovery codes                                                                                                            | Operator, then owner             | Provisioning approval          |
| L6  | Owner loads the real catalog, images, stock and delivery zones/fees in the admin area; operator validates (prices > 0, stock, images served from private R2, active zones)                                                                                       | Owner, operator                  | —                              |
| L7  | Bank account confirmation (a ₦100 transfer shows the exact account name customers will see)                                                                                                                                                                      | Owner                            | —                              |
| L8  | Production end-to-end test with checkout enabled behind Access: order, reservation, cancel/expiry restock, receipt upload, payment review/approval; test orders cancelled and audited afterwards                                                                 | Operator + owner                 | Checkout-enable deploy         |
| L9  | Public launch: narrow Access to `afnancollectionkn.com/admin*` and `/api/admin*` (this also covers `/api/admin-security/*`), so the storefront is public, checkout enabled; live verification on phone and desktop; rollback = re-widen Access to the whole host | Operator                         | **Final launch authorization** |

**Customer accounts:** production keeps sign-up disabled (`disableSignUp: !testMode(env)`, `src/backend/auth.ts`). Customers check out as guests, and the order reference and receipt upload work without an account. Opening customer registration would be a separate owner decision and code change.

## Owner Access cutover: executed 2026-11-16 (acceptance app `00b0cf57`)

- `RESEND_API_KEY` was added by the owner in the dashboard, producing acceptance version `7f93d8e5` (bindings otherwise unchanged).
- Steps done:
  1. Deny-everyone `4ef44160` moved to precedence 3.
  2. Owner Allow `e5f39644` created (`admin@afnancollectionkn.com`, requires PIN login `382280d1`, 4 h session) at precedence 2. Cloudflare renumbered Service Auth `d4c4d7c0` to 1.
  3. `allowed_idps` set to `["382280d1…"]` and `auto_redirect_to_identity: true`; read-back confirmed only these two fields changed.
- **Finding:** with the deny-everyone policy present, anonymous browser requests return 401 instead of the PIN login. Access matches `everyone` Block before identity is known, so the owner cannot start sign-in. Heroine's app (same IdP) has no Block policy and redirects normally. Access denies by default, so removing `4ef44160` would expose nothing; **this deletion is awaiting explicit owner approval** (a deviation from the plan, which kept the policy).
- Current state: everyone, including the owner, is denied. Rollback: delete `e5f39644` → `4ef44160` back to 1 → `allowed_idps []`, `auto_redirect false`.

## Incident 2026-11-16: "code sent" but no email (root cause and fix)

**Symptom:** the owner requested a code for `admin@afnancollectionkn.com` on the acceptance site. The UI advanced, no email arrived, and Resend showed no request.

**Root cause:** no administrator was provisioned (`user` 0 rows). With sign-up disabled, Better Auth 1.7.20 (`plugins/email-otp/routes.mjs` 103–108) answers a code request for an address with no account with `{success:true}`. It generates no code, stores no verification row and never calls the sender. This is intended non-enumerating behaviour: Resend, the key and `noreply@` were never exercised.

**Changes (PR "admin email-code diagnostics"):**

- **Client:** the response is unchanged and still non-enumerating. The UI now says a code arrives only if the address belongs to an existing account, and that administrator accounts are created by the store operator.
- **Operator-only Worker log events** (no address, code or key): `auth.otp.no_account`, `auth.email.accepted`, and `auth.email.provider_rejected` with the HTTP status.
- **`tests/admin-otp.mjs`** (25 assertions, Resend stubbed, part of CI and both deploy gates):
  - no account → no provider call and no verification row;
  - provisioned administrator (real bootstrap SQL) → exactly one Resend request from `noreply@` to the owner;
  - provider 403 → still a generic 200 to the client, status visible to operators;
  - the code and address never appear in logs.

**Provisioning remains gated** (`OWNER-IDENTITY-MFA.md`, `AGENTS.md`). Before the bootstrap SQL runs on acceptance D1, the nominated verifier must confirm through an already-trusted channel both the owner's identity and this specific action ("create pending administrator admin@afnancollectionkn.com on Afnan acceptance; owner then enrols WebAuthn"). The outcome, date, method and an approval reference go in restricted storage. Only the reference is given to the operator. The operator records whether it independently contacted the verifier.
