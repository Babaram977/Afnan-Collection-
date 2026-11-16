# Restore QServers mail delivery for `afnancollectionkn.com` — prepared procedure (not executed)

Prepared 2026-11-16 for owner approval. **No DNS change has been made.** Scope: the `afnancollectionkn.com` zone in Cloudflare and the owner's QServers cPanel mail settings. Heroine Collection, the Afnan Worker, checkout, payments and production are out of scope.

## Facts (verified)
- **Owner:** `support@afnancollectionkn.com` is a QServers-hosted mailbox, set up in the iPhone Mail app. An outside test message **failed with a DNS lookup error**.
- **Cloudflare is authoritative** for the domain since 2026-11-13 01:45Z (zone active, full; nameservers `jake`/`molly.ns.cloudflare.com`; previously `ns1`/`ns2.qservers.net`).
- **The Cloudflare zone has only Resend's 3 records** (`send` CNAME, `rsend` CNAME, `resend._domainkey` TXT, added 2026-11-14). There is **no MX, no `mail` host record and no root SPF**, so outside mail cannot be delivered. This matches the failed test.
- The 13 Nov import scan of the QServers DNS imported **no** records, so the QServers mail records were never copied to Cloudflare.

## Where the authoritative values are (owner, read-only; QServers cPanel)
The operator cannot see the QServers account, and these values are account-specific; **they are not guessed here.** In QServers cPanel:
1. **Zone Editor** (Domains → Zone Editor → `afnancollectionkn.com` → Manage): cPanel usually still holds the domain's old zone even though it is no longer authoritative. Copy exactly:
   - the **MX** record(s): priority and target, typically `mail.afnancollectionkn.com`;
   - the **A** record for `mail.afnancollectionkn.com`: the **server IPv4 address**, plus AAAA if present;
   - the **TXT** record at `afnancollectionkn.com` starting `v=spf1`;
   - the **TXT** record at `default._domainkey.afnancollectionkn.com` starting `v=DKIM1`;
   - optional: `webmail`, `autodiscover`, `autoconfig`, `cpanel` (CNAME or A).
2. **Email Deliverability** (Email → Email Deliverability → `afnancollectionkn.com` → Manage): shows cPanel's **expected** SPF and DKIM values. Use these if they differ from the Zone Editor.
3. **Email Routing** (Email → Email Routing): it **must be "Local Mail Exchanger"**. Because the domain's DNS is now outside QServers, cPanel's automatic detection can pick "Remote", which would make the server refuse local delivery. This is a cPanel setting, not DNS.
4. **iPhone Mail account settings** (Settings → Apps → Mail → Mail Accounts → the support account): note the **incoming (IMAP or POP)** and **outgoing (SMTP)** host names.

## Records to add in Cloudflare (filled in from step 1 or 2 before approval)

| # | Type | Name | Value | Proxy | TTL |
|---|---|---|---|---|---|
| 1 | A | `mail` | `<QServers server IPv4 from cPanel>` | **DNS only (grey cloud)** | Auto |
| 1b | AAAA | `mail` | `<server IPv6, only if cPanel has one>` | **DNS only** | Auto |
| 2 | MX | `@` (`afnancollectionkn.com`) | `mail.afnancollectionkn.com`, priority `<from cPanel, usually 0>` | n/a | Auto |
| 3 | TXT | `@` | `<exact v=spf1 value from cPanel>`, e.g. `v=spf1 +a +mx +ip4:<IP> ~all` | n/a | Auto |
| 4 | TXT | `default._domainkey` | `<exact v=DKIM1; k=rsa; p=… from cPanel>` | n/a | Auto |
| 5 (optional) | CNAME or A | `webmail`, `autodiscover`, `autoconfig` | as in cPanel | **DNS only** | Auto |

**Rules:**
- The mail host must be **DNS-only**. Cloudflare's proxy does not carry IMAP, POP or SMTP, and proxying would break mail and the iPhone connection.
- **Exactly one** root SPF record. Resend needs **no** root SPF entry: it sends from `send.afnancollectionkn.com` and signs with `resend._domainkey`. If anything else is later added at the root, it is merged into this single record.
- **Resend records stay untouched** (`send`, `rsend`, `resend._domainkey`). The cPanel DKIM selector `default` does not collide with `resend`.
- **No Cloudflare Email Routing:** it would take over the root MX from QServers.
- No website records are added. The storefront is on `workers.dev` behind Access, and the root domain website is a separate, later decision.

## Effect on the iPhone Mail configuration
- **If the iPhone uses `mail.afnancollectionkn.com`** as its incoming or outgoing server: that name **has not resolved since 13 Nov**, so the phone is probably failing now (or relying on cached connections). Record 1 **restores** it.
- **If the iPhone uses a QServers server name** (for example `serverNN.qservers.net` or similar): the change does **not** affect the phone, because the phone talks to QServers directly.
- Either way, nothing on the phone needs changing. If the phone warns about the certificate for `mail.afnancollectionkn.com`, cPanel's AutoSSL renews it once record 1 resolves to the server, and DNS-only is required for that.

## Verification after approval and change
1. Cloudflare read-back: the records match the table exactly; Resend records are unchanged.
2. **Public view** (owner, from any browser): check the domain at an MX or DNS lookup site, for example `dns.email` or MXToolbox. MX → `mail.afnancollectionkn.com` → the server IP; one SPF; DKIM `default` present.
3. **cPanel → Email Deliverability** shows SPF and DKIM "valid" (green).
4. **External delivery:** from Gmail (or another outside account), send to `support@afnancollectionkn.com`; it arrives in the iPhone inbox. Then reply from the iPhone, and check in Gmail ("Show original") that **SPF = pass** and **DKIM = pass**.
5. Resend dashboard: the domain is still **Verified**.
6. Allow up to the record TTL (Auto ≈ 5 minutes on Cloudflare) for the change to take effect. Senders that already tried and failed during the outage may retry for some hours before giving up.

## Rollback
Delete the added records (1–5). That returns the zone to exactly today's state: no inbound mail, Resend unaffected. This is no worse than now. Every added record is recorded with its Cloudflare record ID at creation, so rollback deletes exactly those.

## After restoration: `admin@` and `sales@` inside QServers (planned, not executed)
cPanel → Email → **Forwarders** → Add Forwarder:

| Address | Forward to |
|---|---|
| `admin@afnancollectionkn.com` | `support@afnancollectionkn.com` |
| `sales@afnancollectionkn.com` | `support@afnancollectionkn.com` |

- **Loop check:** `support@` must have **no** forwarder back to `admin@` or `sales@`. The **Default Address** (catch-all) should be set to *Discard with error* (`:fail:`), not forward to these addresses.
- Verify: outside test messages to `admin@` and to `sales@` each arrive once in the `support@` inbox.
- **Alternative:** separate mailboxes for `admin@` and `sales@` if different people need them; this uses mailbox quota.
- Effect on the app: Access PINs and app sign-in codes to `admin@`, and payment-review notices to `sales@`, will land in the `support@` inbox. That inbox therefore holds admin sign-in codes, so protect the iPhone and the mailbox password accordingly.

## Approvals required
1. The owner supplies the values from cPanel steps 1–2 (Zone Editor / Email Deliverability) and the iPhone server host names from step 4. These are not secrets; the DKIM value is a public key.
2. **Approval of the exact filled-in records** before anything is added in Cloudflare.
3. The owner confirms cPanel Email Routing is **Local Mail Exchanger**.
4. After verification passes, approval to create the two cPanel forwarders (owner action in cPanel).

---

## Owner-supplied QServers cPanel records (Zone Editor screenshots, 2026-11-16)

| Name | Type | Value | TTL |
|---|---|---|---|
| `afnancollectionkn.com.` | A | `192.154.254.25` | 14400 |
| `afnancollectionkn.com.` | MX | priority `0`, destination `afnancollectionkn.com` | 14400 |
| `afnancollectionkn.com.` | TXT | `v=spf1 +a +mx +ip4:192.154.254.25 ~all` | 14400 |
| *(name not visible; expected `_dmarc.afnancollectionkn.com.`)* | TXT | `v=DMARC1; p=none;` | — |
| `default._domainkey.afnancollectionkn.com.` | TXT | `v=DKIM1; k=rsa; p=MIIBIjAN…IDAQAB;` (screenshot truncated at the right edge; **full text required**) | 14400 |
| `ftp.afnancollectionkn.com.` | A | (value not shown) | 14400 |
| `_carddav._tcp.afnancollectionkn.com.` | SRV/TXT | (cPanel calendar/contacts discovery) | 14400 |

**cPanel zone's own nameservers:** `ns29.qservers.net`, `ns30.qservers.net`, `ns29.qserverscloud.com`, `ns30.qserverscloud.com`. **cPanel server:** `14.qservers.net`.

**Observation:** before 2026-11-13 the registrar delegated to `ns1/ns2.qservers.net` (Cloudflare's `original_name_servers`), not the `ns29/ns30` servers this zone lists. If `ns1/ns2` did not carry the zone, that explains why Cloudflare's import scan found nothing, and outside mail may have been failing before 13 Nov as well. The restoration below fixes both cases.

## Decision: MX target

- **Option 1, original exactly:** root A `192.154.254.25` (DNS-only) + MX → root.
  - It would make the root domain serve whatever QServers hosts.
  - It conflicts with a future Cloudflare-hosted website: a proxied root cannot be an MX target, so mail breaks unless the MX and SPF change at the same moment.
- **Option 2 (recommended), dedicated mail hostname:** A `mail` `192.154.254.25` (DNS-only) + MX → `mail.afnancollectionkn.com`.
  - QServers accepts mail for its local domains regardless of the MX hostname, provided cPanel Email Routing = Local.
  - The root stays free for the website decision.
  - SPF is unchanged: `ip4:` covers the server and `+mx` resolves through `mail`; `+a` finds no root address, which is a single tolerated void lookup.
- **Condition for Option 2:** the iPhone's incoming and outgoing server must **not** be the bare `afnancollectionkn.com`. If it is, either keep Option 1 temporarily, or change the iPhone server to `mail.afnancollectionkn.com` (owner decision).

## Final minimal restoration (Option 2; for approval)

| # | Type | Name (Cloudflare) | Value | Proxy | TTL |
|---|---|---|---|---|---|
| 1 | A | `mail` | `192.154.254.25` | **DNS only** | Auto |
| 2 | MX | `@` | `mail.afnancollectionkn.com`, priority `0` | n/a | Auto |
| 3 | TXT | `@` | `v=spf1 +a +mx +ip4:192.154.254.25 ~all` | n/a | Auto |
| 4 | TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=<full key from cPanel>` | n/a | Auto |
| 5 | TXT | `_dmarc` | `v=DMARC1; p=none;` | n/a | Auto |

- **Stages:** records **1–2 restore inbound delivery** (urgent) and can be applied first. Records **3–5** cover outgoing authentication and DMARC.
- **Not restored:** root A (website decision), `ftp`, the cPanel service names (`cpanel`, `webmail`, `autodiscover`, `autoconfig`) and the CardDAV/CalDAV entries. None is needed for mail delivery or IMAP/SMTP; each can be added later on request, DNS-only.
- **No duplicates:** the zone currently has no root SPF, no `_dmarc` and no `default._domainkey`. Resend's `send`, `rsend` and `resend._domainkey` are untouched, and their names do not collide.

## Still required before approval
1. **The full DKIM value as text**, from Zone Editor → `default._domainkey` → Edit (copy the Record field), or from Email Deliverability.
2. **Confirm the DMARC record's name** (expected `_dmarc`).
3. **iPhone server names** (incoming and outgoing) for the support account.
4. **cPanel Email → Email Routing**: confirm "Local Mail Exchanger".
5. Optional: the **CNAME** tab of Zone Editor, to see whether cPanel had a `mail` CNAME, and cPanel → Email Accounts → Connect Devices for `support@` (the recommended client server names).

## Finalised plan (2026-11-16) — awaiting the remaining checks and owner approval

**iPhone (owner-verified):** incoming IMAP `14.qservers.net`, outgoing SMTP `14.qservers.net`. The phone connects to the QServers server name directly and **does not depend on any `afnancollectionkn.com` hostname**, so these DNS changes cannot affect it. The Option 2 condition is satisfied.

### Stage 1 — restore inbound delivery (urgent)
| # | Type | Name | Content | Priority | Proxy | TTL |
|---|---|---|---|---|---|---|
| 1 | A | `mail.afnancollectionkn.com` | `192.154.254.25` | — | **false (DNS only)** | 1 (Auto) |
| 2 | MX | `afnancollectionkn.com` | `mail.afnancollectionkn.com` | `0` | — | 1 (Auto) |

### Stage 2 — outgoing authentication (preserves the existing QServers configuration)
| # | Type | Name | Content | TTL |
|---|---|---|---|---|
| 3 | TXT | `afnancollectionkn.com` | `v=spf1 +a +mx +ip4:192.154.254.25 ~all` (exact cPanel value; the zone's only SPF) | 1 |
| 4 | TXT | `default._domainkey.afnancollectionkn.com` | `v=DKIM1; k=rsa; p=<complete key, pending>` | 1 |
| 5 | TXT | `<DMARC hostname, pending; expected _dmarc>.afnancollectionkn.com` | `v=DMARC1; p=none;` | 1 |

**Preserved unchanged:** `send` CNAME, `rsend` CNAME, `resend._domainkey` TXT (Resend). No other zone changes, and no Cloudflare Email Routing.

**Execution** (operator, after approval; Cloudflare DNS API on zone `a3c18f29…`):
1. Re-read the zone and confirm it still contains exactly the 3 Resend records and none of the names above.
2. Create the records **one at a time**, recording each record ID.
3. Read back each record (type, name, content, priority, `proxied:false` for `mail`).
4. Confirm the Resend records are byte-identical to before.

**Verification:**
- Owner: a public DNS view (for example MXToolbox) shows MX → `mail.afnancollectionkn.com` → `192.154.254.25`.
- Owner: an **iCloud test message to `support@` arrives** in the iPhone inbox (it previously bounced with "unable to look up host").
- After Stage 2: a reply from `support@` shows **SPF = pass and DKIM = pass** in the recipient's "Show original"; cPanel Email Deliverability shows valid; Resend still **Verified**.

**Rollback:** delete exactly the recorded IDs. Stage 1 and Stage 2 roll back independently, and the result is today's state.

### Remaining checks before approval (owner)
1. **cPanel → Email → Email Routing** for `afnancollectionkn.com`: confirm **Local Mail Exchanger**. If it shows Remote or Automatic, set it to Local *before* Stage 1, or delivery will be refused at the server.
2. **The complete DKIM record** as text (Zone Editor → `default._domainkey` → Edit → copy the Record field, or Email Deliverability). It should begin `v=DKIM1; k=rsa; p=MIIBIjAN` and end `IDAQAB;`.
3. **The DMARC record's hostname** (Zone Editor → TXT filter → the `v=DMARC1; p=none;` row → Name).

## Stage 1 APPLIED — 2026-11-16T01:53Z (owner-approved)

**Pre-checks (owner):** cPanel Shared IP `192.154.254.25`; Email Routing = Local Mail Exchanger; iPhone IMAP/SMTP = `14.qservers.net`.

**Pre-check (operator, 01:52:42Z):** the zone held exactly the 3 Resend records, with no MX and no record at `mail`. PASS.

| Record ID | Type | Name | Content | Priority | Proxy | TTL |
|---|---|---|---|---|---|---|
| `6904a51db7ab8870c30f7ab8995d9d20` | A | `mail.afnancollectionkn.com` | `192.154.254.25` | — | DNS only | Auto |
| `08f6a4e8b056e8644c05b765c19a7b16` | MX | `afnancollectionkn.com` | `mail.afnancollectionkn.com` | 0 | — | Auto |

**Read-back (01:53:20Z):** 5 records; both new records match exactly; **the Resend records (`send`, `rsend`, `resend._domainkey`) are unchanged** (type, name, content, proxy and TTL compared against the pre-check). The zone is active on Cloudflare nameservers.

**Public resolution:** not observable from the operator sandbox (no resolver; public DNS-over-HTTPS blocked). The owner verifies with a public lookup and an external delivery test.

**Rollback:** delete record IDs `08f6a4e8…` (MX) and `6904a51d…` (A).

**Not changed:** root website, SPF, DKIM, DMARC (Stage 2, separate approval), Resend, Email Routing, other zones and resources.

**Separate finding (owner):** cPanel shows a self-signed certificate warning. Inbound delivery is unaffected, because sending servers use opportunistic TLS. The mail server's certificate for `14.qservers.net` and `mail.afnancollectionkn.com` should be reviewed separately (cPanel → SSL/TLS Status / AutoSSL), now that `mail` resolves to the server.

## Inbound delivery CONFIRMED — 2026-11-16 03:01 WAT (02:01Z)

- **Real delivery:** a message from `support@dripplex.com` arrived in the `support@afnancollectionkn.com` inbox at 03:01 WAT, visible in iPhone Mail (owner screenshot). That was 8 minutes after Stage 1 went live (01:53Z).
- **Supporting checks:**
  - public MX and `mail` A verified through Google DNS (02:06Z);
  - no DS record, so DNSSEC is not involved;
  - MXToolbox SMTP test passed at 03:10 WAT: `220 14.qservers.net ESMTP Exim 4.100.1`, STARTTLS, reverse DNS, no open relay.
- **Still pending:** the owner's earlier iCloud test (sent around the DNS fix) has not arrived. It is consistent with iCloud having cached the earlier "no MX" answer (negative TTL 1800 s) and retrying on its own schedule. One later test from a second outside provider is advisable to confirm reliability.

## Stage 2 read-only baseline (public, Google DNS, 02:13Z)
| Name | Type | Public answer |
|---|---|---|
| `afnancollectionkn.com` | TXT (SPF) | **none** |
| `_dmarc.afnancollectionkn.com` | TXT | **none** (NXDOMAIN) |
| `default._domainkey.afnancollectionkn.com` | TXT | **none** (NXDOMAIN) |
| `resend._domainkey.afnancollectionkn.com` | TXT | present (Resend DKIM) |
| `send` / `rsend.afnancollectionkn.com` | CNAME | present (Resend) |

**Consequence:** outgoing mail from `support@` (QServers) currently has **no SPF and no DKIM** published, and receivers may mark it as spam. Stage 2 (single SPF, QServers DKIM `default`, DMARC `p=none`) addresses this; Resend is unaffected either way. **Pending owner inputs:** the complete DKIM value as text, and the DMARC record's hostname.

## Stage 2 preparation — authentication (2026-11-16T02:15Z, read-only; for approval)

### Resend (verified in public DNS through Google DNS)
| Record | Resolves to | SPF / MX published there |
|---|---|---|
| `send.afnancollectionkn.com` CNAME | `send.forge.rmta.net` | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all`; MX `10 feedback.forge.rmta.net` |
| `rsend.afnancollectionkn.com` CNAME | `rsend-euw1.forge.rmta.net` | `v=spf1 include:amazonses.com ~all`; MX `10 feedback-smtp.eu-west-1.amazonses.com` |
| `resend._domainkey.afnancollectionkn.com` TXT | — | DKIM public key, `p=MIGf…` (1024-bit) |

- **Resend uses dedicated return-path subdomains** (`send`, with `rsend` as fallback), never the root, for the envelope sender that SPF evaluates. **A root SPF record does not affect Resend and must not include it.**
- DMARC alignment for Resend mail (`From: orders@afnancollectionkn.com`): DKIM `d=afnancollectionkn.com` (selector `resend`) is aligned, and the SPF domain `send.afnancollectionkn.com` is relaxed-aligned with `afnancollectionkn.com`.
- **Not verifiable here:** whether the Resend dashboard shows the domain **Verified**. The owner checks; no Resend credentials are used.

### QServers (verified)
- `192.154.254.25` PTR → `14.qservers.net`, and `14.qservers.net` A → `192.154.254.25`: forward-confirmed reverse DNS. Also confirmed by the MXToolbox SMTP banner `220 14.qservers.net ESMTP Exim 4.100.1`.

### Proposed records (Stage 2)
| # | Type | Name | Content | Notes |
|---|---|---|---|---|
| 3 | TXT | `afnancollectionkn.com` | **Recommended:** `v=spf1 +mx +ip4:192.154.254.25 ~all` · **or exact original:** `v=spf1 +a +mx +ip4:192.154.254.25 ~all` | The **only** root SPF; the zone has none today |
| 4 | TXT | `default._domainkey.afnancollectionkn.com` | `v=DKIM1; k=rsa; p=<complete key>` | **Pending** the complete value from cPanel |
| 5 | TXT | `_dmarc.afnancollectionkn.com` (name to be confirmed in cPanel) | `v=DMARC1; p=none;` | Monitoring only; same as the original. Optional later: add `rua=mailto:<reports address>` |

**SPF recommendation: drop `+a`.**
- The root has no A record today, so `+a` matches nothing, which is a tolerated void lookup.
- When the website later moves to Cloudflare, a **proxied** root A would make `+a` authorize **Cloudflare's shared edge addresses** to send mail as the domain, which is unintended.
- `+mx` (resolves to `192.154.254.25`) plus the explicit `ip4:192.154.254.25` fully cover QServers.
- Both variants use at most 2 DNS lookups, well under the limit of 10. cPanel Email Deliverability checks that the server IP is authorized, which either variant satisfies.

### Conflict checks
- **No duplicate SPF:** the zone has no root TXT today.
- **No collisions:** `default._domainkey` and `_dmarc` do not exist yet, and `resend._domainkey` is a different selector.
- **Preserved unchanged:** MX `@` → `mail` (0); A `mail` → `192.154.254.25` (DNS only); Resend `send`, `rsend`, `resend._domainkey`.

### DKIM validation (when the owner supplies the complete record)
1. The text starts `v=DKIM1; k=rsa; p=` and the `p=` value is continuous base64. Line breaks or quotes from copying are removed; cPanel may split it into 255-character strings, which are joined without spaces.
2. The `p=` value decodes to a valid RSA public key, expected 2048-bit (`MIIBIjAN…IDAQAB`). It is checked locally, without sending it anywhere.
3. Its start and end match the cPanel screenshot (`MIIBIjANBgkqhkiG9w0BAQEFAA…`, `…LaXPL2frVOo6nRxwRQIDAQAB;`).

### Validation after publishing (approval required first)
1. Cloudflare read-back: exactly 3 new TXT records; MX, `mail` and Resend unchanged; a single root SPF.
2. Public view (Google DNS / MXToolbox): SPF, DKIM `default` and DMARC resolve; MXToolbox SPF and DMARC checks show no syntax errors.
3. cPanel → Email Deliverability: SPF and DKIM shown as **valid**.
4. The owner sends **one** message from `support@` (iPhone, through `14.qservers.net`) to a Gmail address. "Show original" should show **SPF: PASS (IP 192.154.254.25)**, **DKIM: PASS (d=afnancollectionkn.com, s=default)** and **DMARC: PASS**.
5. Resend: the dashboard is still **Verified**. If a Resend send is ever tested, Gmail should show DKIM pass for `s=resend`.

**Rollback:** delete the 3 TXT record IDs created. That returns the zone to today's Stage 1 state, with inbound mail unaffected.

**Caveat:** authentication improves trust and DMARC results; it does not guarantee inbox placement.
