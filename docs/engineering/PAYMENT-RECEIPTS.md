# Payment receipts: controls and limits

Owner-approved 2026-11-15. Receipts are customer-supplied evidence of a bank transfer. They are **never proof of payment**: an MFA-verified administrator must confirm the actual Moniepoint credit before any order is marked paid.

## What the server checks (`src/backend/receipts.ts`, `inspectReceipt`)
These are **screening checks, not full decoding and not malware scanning.**

| Type | Checked | Not checked |
|---|---|---|
| PNG | Signature, `IHDR` as the first chunk, `IEND` as the final chunk, minimum size | Chunk CRCs, that pixel data decodes |
| JPEG | `FFD8FF` start, a valid second segment marker, minimum size | That the full image decodes; trailing data |
| WebP | `RIFF…WEBP`, a declared size that fits the file, a `VP8`/`VP8L`/`VP8X` chunk | That the bitstream decodes |
| PDF | `%PDF-` header, `%%EOF` in the final 1 KB; refuses `/Encrypt`, `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile(s)`, `/RichMedia`, `/XFA`, `/SubmitForm`, `/ImportData`, `/GoToE` | Names inside compressed object streams; malicious content that avoids these names; general malware |

All files are also limited to 5 MB, typed by content (never by filename or declared type), and de-duplicated per order by SHA-256.

## Controls that do not depend on those checks
- **Private storage:** a separate private R2 bucket (`RECEIPTS`) with no public access, custom domain or CORS. Random object keys never leave the server, and the public `/media` route cannot read the bucket.
- **Restricted download:** only an admin with a WebAuthn session can retrieve a receipt, and every view is audited. Responses are `no-store`, `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin` and `Referrer-Policy: no-referrer`.
- **PDFs are never rendered on our origin:** they are always sent as `Content-Disposition: attachment`, so staff open them in their own PDF viewer.
- **No server-side parsing or rendering:** receipts are not decoded, thumbnailed or converted, which keeps parser vulnerabilities out of the Worker.

## Operational guidance for staff
Open PDFs in an up-to-date viewer with JavaScript disabled. Do not forward receipts outside the dashboard. Judge payment by the bank credit, never by how a receipt looks.

## Possible future hardening (not implemented)
Full image decoding and re-encoding of images, and an external malware-scanning service for PDFs. Both are worth reconsidering before production volumes.
