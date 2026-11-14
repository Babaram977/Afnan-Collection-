# Production authentication readiness and deployment plan

Implementation branch: feat/isolated-admin-mfa, based on approved cef6e6e. This report supersedes the old conclusion that an account-membership IdP is necessary for application administration. Application MFA is implemented for review; owner authentication/MFA is still not verified. No Access/IdP/Worker settings were modified.

## Gates

| Gate | Evidence required / current state |
| --- | --- |
| Source/build | Local and exact-PR-head CI results in SECURITY-TEST-REPORT.md; final release approval still required. |
| Authentication | Local email + signed WebAuthn flow tested. Real owner/mailbox verification BLOCKED. |
| MFA/recovery | Local replay/expiry/UV/signature/recovery tests and browser virtual-device enrollment. Real devices, backup key and supervised recovery BLOCKED. |
| Resend | Server integration and mocked failure tests implemented. Actual account, domain, key and authorized delivery BLOCKED. |
| D1 | Additive 0003 migration, local tests and ledger replay; remote migrations/recovery point/restore rehearsal BLOCKED. |
| R2 | Dedicated bucket public access remains disabled. Local private upload tests; hosted authorized/denied operations BLOCKED. |
| Secrets | AUTH_SECRET and restricted Resend key not installed. Secure production configuration BLOCKED. |
| Domain | afnancollectionkn.com is proposed; exact public origin/cutover approval and TLS/routing evidence BLOCKED. |
| Security | Automated and dependency-check evidence in test report; final security review and owner evidence pending. |
| Rollback | Procedure below; first deployment has no preceding Worker version. Remote data recovery remains BLOCKED until rehearsed. |

## Resource and configuration review

Reuse Worker afnan-collection-storefront, ID debc58162c864e1e8ded0d63bb8823b5, account b4e142fe9da84ef204eecda2efe4a730. DB binding: afnan-collection-acceptance, UUID 11950c2f-14bb-4a31-9add-356f155dea4e. MEDIA binding: afnan-product-media-acceptance. ASSETS: .output/public; entry worker.ts; nodejs_compat; compatibility date 2026-11-13 preserved. Public image responses still require active product/banner visibility; bucket must remain private and unbound to public R2 domains. No unrelated bindings.

Read-only refresh: no application deployment, workers.dev/previews false, D1 zero tables, R2 managed public access false, zero Access apps and the shared IdP still member-only. No duplicate resources or remote writes made. Current resources retain acceptance names deliberately; reuse for production requires a clean inventory/data review, not attaching another business's resources. Never upload fixture schemas/data. No real customer records exist in the observed empty D1.

`config/wrangler.production.example.jsonc` is a review template, not a deployment command. It has actual isolated resource IDs, proposed HTTPS origin, production mode, empty routes, disabled workers.dev/previews, disabled checkout/payments and sender verification false. It contains no secrets. Root wrangler.jsonc remains local-development-only and must not be deployed. The production schema intentionally denies public registration outside explicit localhost tests. Do not enable registration/checkout/payments to make acceptance tests pass.

## Resend owner checklist

- Identify the owner-controlled Resend account/workspace and prove control privately; do not invent an account identifier. Add/inspect afnancollectionkn.com in that account and supply its provider-issued verification status.
- Obtain exact DKIM, SPF/return-path and applicable DMARC requirements from that domain's Resend screen/API. Preserve existing MX, avoid duplicate SPF and reconcile existing DMARC with the mail administrator. No guessed records and no DNS writes in this task.
- Verify admin@afnancollectionkn.com receives mail; Resend outbound-domain verification does not establish an inbound mailbox.
- Create/use an approved server-side, domain-restricted sending key. Deliver through secret storage; never chat, Git, VITE_* variables or command-line literals. AUTH_SECRET must be securely generated (at least 32 characters), separate from Resend and other businesses. No Paystack key is needed while payments are disabled.
- Set EMAIL_FROM=orders@afnancollectionkn.com and EMAIL_SENDER_VERIFIED=true only after actual provider verification and approved sending test. The flag is an operator assertion, not external proof. Validate real receipt, wrong/expired/replayed codes and denied unknown signup with explicit email-test authorization. Sending endpoint returns a generic acknowledgement even on delivery errors; monitor fixed auth.email.unavailable events without recipient/provider bodies.

## Migration and controlled release sequence (not executed)

1. Freeze/review the exact release SHA and CI. Obtain real owner/device/mailbox/sender evidence and approvals for security provisioning, secrets, email tests, domain and the release. Decide restricted audit retention. No account invitation/shared IdP change is necessary for the implemented application flow; any optional Access deployment is a separate scoped security decision.
2. Inspect the exact account/Worker/D1/R2 and pending migrations. Capture a protected baseline D1 export/recovery bookmark; confirm Time Travel entitlement/retention and authorized restore operator. Rehearse restore into a separately approved isolated target before claiming recovery ready. Back up existing media metadata/keys without overwriting production objects.
3. With separate production migration approval use the reviewed configuration and exact DB: `bunx wrangler d1 migrations list DB --config config/wrangler.production.example.jsonc --remote`; then approved `bunx wrangler d1 migrations apply DB --config config/wrangler.production.example.jsonc --remote`. List is read-only; apply writes. Verify identity and migrations 0001, 0002, 0003, foreign-key integrity and absence of test tables/data. Ledger replay skips applied migrations; raw migration SQL is not rerunnable.
4. With explicit secret/provisioning authorization, stage AUTH_SECRET/RESEND_API_KEY and verified sender config securely and execute only the reviewed pending-owner bootstrap. Do not mark email verified or MFA enrolled manually. Ordinary Wrangler secret writes may deploy; choose a reviewed staged version workflow only after approval, never use secret installation as an implicit premature deployment.
5. After gates pass, publish only to the existing Worker under conditional deployment approval using the reviewed config; keep origin/routes disabled until denied/authorized paths can be verified through an approved isolated protection mechanism. Hosted enrollment requires an approved protected origin, real-email authorization and personal owner participation. Hosted verification may require a first protected acceptance version while production gates are still blocked. That needs a separate explicit protected-acceptance upload/test authorization; conditional public-launch approval does not itself clear this dependency. If a protected prelaunch origin/protection is not yet approved, stop rather than enabling workers.dev or inventing a route.
6. Owner enrolls and challenges MFA personally, saves recovery codes and registers a separate backup device. Confirm email-only/customer/forged-cookie/disabled-session denials, product/image CRUD, inventory/order permissions and private R2. Do not process real payments. Approve the final production hostname/RP ID before enrollment or plan verified re-enrollment for a different hostname.
7. Only after hosted protection and readiness pass, perform explicitly approved public hostname/DNS cutover. Verify TLS, storefront/navigation/prices/images/cart, public API reads, denied privileged APIs, mobile Safari on a real device, monitoring and rollback. Checkout/payment/registration remain disabled; their activation is a separate gate. No public URL/version/timestamp may be reported as live before independent verification.

## Rollback

First release: no prior Worker version exists. If checks fail, keep or restore the origin to disabled under incident authorization, preserve sanitized evidence and stop. Do not enable a placeholder or remove security to recover. Subsequent releases: record the prior deployment/version ID and reviewed rollback command before publishing; use `wrangler rollback <previous-version-id> --config <reviewed-config>` only with incident authorization. Version rollback does not restore D1/R2. Never roll back to pre-MFA code after enrolling administrators; disabling the origin is safer than removing mandatory MFA.

0003 is additive and blocks existing staff until enrollment. Leave the schema in place for a forward fix; do not drop MFA tables or restore stale sessions to undo a release. Restore data only from a verified protected recovery point with separate approval and an isolated rehearsal, then invalidate sessions/epochs and reverify security. Preserve media objects unless a separately approved operation requires removal. Never modify Heroine, DrippleX, Landonova or Lovable/DNS routing for this rollback.
