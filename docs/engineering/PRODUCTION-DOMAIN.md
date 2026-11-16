# Production storefront on afnancollectionkn.com (owner-authorized 2026-11-16)

| Item                 | Production                                                                                                  | Acceptance (unchanged)                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Worker               | `afnan-collection-production` (workers.dev off)                                                             | `afnan-collection-storefront` (workers.dev, behind Access) |
| Hostnames            | `afnancollectionkn.com` (primary); `www.afnancollectionkn.com` → 301 to primary (`worker.ts`)               | `afnan-collection-storefront.danwakili.workers.dev`        |
| D1                   | `afnan-collection-production` `73ddfc46…`                                                                   | `afnan-collection-acceptance` `11950c2f…`                  |
| R2                   | `afnan-product-media-production`, `afnan-payment-receipts-production`                                       | `…-acceptance` buckets                                     |
| `AUTH_SECRET`        | its own, generated 2026-11-16 (never the acceptance one)                                                    | its own                                                    |
| Admin authentication | default (email code + WebAuthn); unchanged                                                                  | `ADMIN_AUTH_MODE=password`                                 |
| Access               | app `c41fff37` covers only `/admin*` and `/api/admin*`, owner email via PIN login; the storefront is public | whole host, owner only                                     |
| Checkout / payments  | disabled / disabled                                                                                         | disabled / disabled                                        |

- **Deploy path:** `deploy-production.yml`. It refuses any route other than the two approved custom domains, and any change to `PAYMENT_MODE` or `workers_dev`. Wrangler creates the domains' DNS records. The MX, SPF, DKIM, DMARC, `mail` and Resend records are untouched.
- **Rollback:** each run records the previous live version (`wrangler rollback <id>`). To take the site offline, detach the custom domains (Workers → `afnan-collection-production` → Domains & Routes). The placeholder version answers 503.
- **Catalogue:** production D1 starts empty apart from the 11 categories. Products entered on acceptance do **not** appear on the public site.

## Production administrator (owner approval 2026-11-16)

- **Mode:** production runs `ADMIN_AUTH_MODE=password`, the same code as acceptance. The deploy guard aborts if it is missing.
- **Provisioning:** `admin@afnancollectionkn.com` is provisioned in the **production** D1 with `scripts/admin-provision-password.mjs`. The owner chooses a new password through a single-use 30-minute link at `https://afnancollectionkn.com/admin?setup=…`. No acceptance credentials are copied.
- **Access:** app `c41fff37` still requires the owner's Cloudflare email sign-in for `/admin*` and `/api/admin*`, including `/api/admin-setup`, before the application login.
