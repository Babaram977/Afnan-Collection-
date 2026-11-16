# Prepared owner-only Resend delivery test — not executed

No real message is authorized by this document. The owner reports afnancollectionkn.com verified and Forge enabled; that does not certify the selected key, account eligibility, mailbox or delivery. Recipient is limited to admin@afnancollectionkn.com and sender to orders@afnancollectionkn.com.

## Prerequisites and credential custody

Owner identifies the correct Resend account/workspace and confirms sending is enabled with sufficient quota/billing eligibility in its dashboard. Make a domain-restricted Sending Access key available through an approved secret reference, not chat/Git/VITE_* variables or command-line literals. No key exists in the currently inspected environment and no signed-in provider inspection tool is available. Confirm actual provider domain status and mailbox control; the three visible sender-related DNS record names alone do not prove this. Do not change DNS, issue a broader key or turn on paid billing to make a test pass.

## Approval scope A — one provider delivery message

Proposed single request, only after explicit owner approval and secure key validation:

- Endpoint: POST https://api.resend.com/emails, using the existing server-side integration pattern and a privately loaded Sending Access key.
- Sender: orders@afnancollectionkn.com.
- Recipient: admin@afnancollectionkn.com only; no CC/BCC, other recipients or attachments.
- Subject: Afnan Collection approved delivery test.
- Body: "This is the owner-approved Afnan Collection email delivery test. It does not grant administrator access. No password, payment or verification code is requested."
- One request, ten-second timeout, no automatic retry and no Worker publication, account creation, code generation or login as a side effect.
- Store only approved audit reference, time, HTTP status and opaque provider message ID in restricted evidence. Do not print the key, recipient headers or provider response body to logs. A successful API acknowledgement proves submission only.

Owner personally confirms receipt and inspects the actual message's authentication results. Confirm SPF/DKIM alignment and applicable DMARC through provider-issued configuration and received headers; do not invent DNS changes. Record delivered/bounced/blocked outcome and restricted evidence reference. If the request times out, reconcile provider status before authorizing a retry to avoid duplicate mail. This delivery test does not prove email-code login, identity or MFA.

## Approval scope B — hosted email-code acceptance

This is a separate approval after an approved protected application origin, dedicated migrations/secrets, pending owner provisioning and human verification are ready. At most five owner-initiated email-code messages to the same exact administrator are proposed for sign-in, expiration/replay, reauthentication and recovery testing. Do not send until that scope is explicitly approved.

The owner uses the actual sign-in UI, which posts to /api/auth/email-otp/send-verification-otp with type=sign-in, then personally enters the received code into the same trusted application. Codex must never request, print, record or submit the owner's code. Verify the five-minute expiry, consumed-code denial and cooldown using only approved requests, without spamming the recipient. Then the owner personally performs WebAuthn enrollment/challenge and the approved recovery drill. Do not treat a generic send acknowledgement, code fixture or virtual authenticator as delivery/ownership evidence.

No live link is supplied because the Worker has no application deployment. Select and authorize the exact trusted origin/RP ID first. Record real authentication/MFA/recovery outcomes only after those ceremonies occur. Production hostname cutover, customer registration, checkout and payments remain separate gates.
