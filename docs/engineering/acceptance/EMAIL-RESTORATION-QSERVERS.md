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
