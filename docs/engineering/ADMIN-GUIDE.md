# Owner administration guide

This describes the implemented local/test system. It is not live. Afnan uses its own Worker bindings, D1 schema, image bucket and auth secret; never connect Heroine's database, media or administrator accounts.

## First owner access

1. The owner chooses an email address and verifies it using the emailed single-use code. Email transport and sender-domain ownership must be configured and tested first.
2. An authorized administrator of Afnan's Cloudflare account verifies the person's business ownership outside the public website, confirms the dedicated Afnan database/environment and checks the matching `user` record has `email_verified=1`.
3. Assign `staff.role='admin'` to that verified user in the reviewed database, recording the operator, date and reason in `audit`. This is an account-owned privileged action, not a website signup capability. Do not grant admin by email domain, first signup, user-supplied role, public token or a first-admin claim endpoint.
4. Verify the owner can open `/admin`, that another customer cannot, and that session revocation works. Production provisioning/role assignment has not been executed here. The local-only bootstrap command and fixture terminal procedure are documented in README.

An administrator can manage catalog, settings, payments and customer sessions. A fulfilment role can inspect orders/delivery details and advance fulfilment, with no catalog, inventory, payment or customer-directory access. Staff offboarding should revoke sessions and remove the role. MFA/stronger staff identity policy remains an owner/security acceptance decision before launch.

## Add a genuine product

1. In **Products**, choose **Add product**. Enter its real name/description and choose a category. A product link name is suggested automatically and remains editable. Select factual age groups/guidance only; no safety claims are invented.
2. Keep it **Draft** while preparing it. Upload up to 12 genuine JPG/PNG/WebP photographs. The browser validates and optimizes product photos to WebP with a maximum 1600-pixel edge; the server checks authorization, allowed signatures and a 5 MB upload limit. Original input is limited to 20 MB and 40 megapixels in the browser.
3. Review private previews and photo descriptions. **Make main image** moves a photo to first position. **Remove from product** unlinks it on the next save. It does not destructively erase the original object; unreferenced/draft images are not publicly delivered. Replacing a photo uses a new random object key, avoiding stale overwrites.
4. Choose **Save product**. In **Prices, sizes, colours and stock**, add each real stocked combination. A unique SKU is suggested or can be assigned manually. Enter regular and optional promotional prices in **naira**, with at most two decimal places; storage and checkout use integer kobo. A promotion must be positive and below the regular price. Clearing it removes the promotion.
5. Enter actual opening stock and the low-stock threshold. Opening stock is audited and is available only for a new variant. Subsequent changes go through Inventory.
6. Save each option, then set product visibility to **Published** and save the product. A priced option is required. The product appears from D1 in the public storefront without a code deployment. Featured/seasonal flags control the corresponding homepage collections.
7. **Draft** unpublishes; **Archived** hides while retaining the record. **Delete product** removes it from management/public catalog through soft deletion and preserves SKU references, inventory records and historical order snapshots. It is confirmed in the UI. It does not erase historical customer orders.

The public product page shows effective prices, regular prices for configured promotions, size/colour/SKU and availability. Images in draft/unlinked products are privately previewed through an authorized API, rather than exposing storage credentials.

## Stock and orders

- **Inventory**: choose a product/SKU, Add or Remove, quantity and reason. Changes and opening balances appear in the movement ledger. Negative stock is rejected; movements are atomic with their stock update. The overview lists low-stock SKUs using each configured threshold.
- Checkout rechecks active products, prices, stock and the selected delivery zone on the server. Simultaneous attempts for the last unit cannot both reserve it. Failed multi-item orders roll back every reservation.
- Pending reservations last 30 minutes as a development default. Cancellation/expiry restores the hold once. Catalog/order/admin traffic releases expired holds. This duration must be accepted or changed before live launch.
- **Orders**: filter by status, inspect purchased item snapshots and customer/address details, and advance Paid → Processing → Dispatched → Delivered. Only an unpaid pending reservation can be cancelled directly. Already-paid orders require the payment/refund workflow.
- Refunds do not automatically restore uninspected physical goods. After an actual return is inspected, record the appropriate audited stock adjustment.

## Store settings

- **Categories**: create/edit a navigation label and its URL-friendly slug. Public navigation and product filters use saved categories.
- **Banners**: enter an actual title and a relative `/shop` or `/product/...` link. Optional photo upload/preview and publication are managed in the dashboard. No discounts or delivery claims are fabricated.
- **Zones**: configure real delivery areas/states, actual fees in naira and whether they are available. No zone/price is activated by the production migration. Start with operationally supported Kano areas; add other states only when the business is ready.
- **Business**: update the address, WhatsApp number and Instagram/TikTok profile links. Validated D1 overrides resolve through the shared business configuration used by the footer/contact/legal sections and SEO. The supplied official defaults remain the source of record; registration numbers and official logo are not silently changed through this form.
- **Content**: publish approved plain-text about/privacy/returns/delivery information. Unset policies remain explicitly unpublished. Plain text avoids injected HTML.
- **Customers**: inspect account records and revoke sessions where appropriate. You cannot make someone staff through a public customer setting.
- **Payments**: inspect transaction state, verify through Paystack, and initiate/check full **test** refunds. Live keys are rejected. Unknown refund outcomes require Paystack-side reconciliation before retrying; never issue a blind second refund. Partial refunds are not implemented.

## Before activation

Choose the actual owner email, verify Cloudflare account/resource ownership, provision isolated resources only under separate authorization, configure strong runtime secrets and verified email delivery, and validate actual Paystack test credentials/webhooks/refunds. Confirm catalog/opening stock, delivery terms/fees, privacy/returns/retention, backups and operational monitoring. Resolve original logo-file access and repository privacy preference. Obtain explicit approval before public deployment, real orders or live payments; this implementation has not performed them.

## Mandatory MFA update

Follow [enrollment and recovery](ADMIN-RECOVERY-RUNBOOK.md). The owner identity is selected as admin@afnancollectionkn.com but mailbox/business ownership is not verified. Email login alone is insufficient: the operator must approve pending enrollment, and the owner must personally enroll and challenge a verified passkey/security key. Staff sessions expire after one hour or 15 minutes idle. Public registration, checkout and payments stay disabled. Original-logo integration is complete; its earlier blocker above is historical. Dedicated Cloudflare resources exist but no application is deployed.
