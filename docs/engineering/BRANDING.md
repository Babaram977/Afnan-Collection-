# Official branding handoff

Owner instruction received 2026-11-13. `src/lib/business.ts` is the authoritative application configuration for supplied business information. The name is **Afnan Collection**; the storefront title remains Afnan Collection Online. Do not confuse the business with Afnan Homes, Heroine Collection or DrippleX.

The supplied official raster logo shows a gold AC monogram with a black ornamental flourish and the AFNAN COLLECTION wordmark on white. The owner confirmed this raster format is the only available version. That format is acceptable; a vector asset is not required.

The original PNG uploaded in commit `3ef6de5` as `public/brand/IMG_8842(2).png` is now installed at `public/brand/IMG_8842(1).png` through a byte-preserving rename. SHA-256 verified: `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`. The 145,165-byte, 460 × 546 image is used unchanged in the shared header/footer, PNG website icon, Store structured data and homepage social metadata. No crop, recolouring, redrawing or derivative was made; the traced SVG remains reference-only and unused.

Owner-supplied public contacts:

- Address: 11 Shehu Naallah Street, Hadejia Road, Kano, Nigeria.
- WhatsApp: +2347035963225; `https://wa.me/2347035963225`.
- Instagram: `https://www.instagram.com/afnan_collectionkn`.
- TikTok: `https://www.tiktok.com/@afnan_collectionkn`.
- Domain: `afnancollectionkn.com`.

CAC **BN 4050963** and TIN **24511952-001** are recorded as supplied, not independently verified. They appear in the business/legal section, not promotional copy or navigation. Do not add hours, email, shipping partners or operational promises without owner-supplied facts. External social/WhatsApp destinations are rendered from configuration with safe new-tab attributes; their account ownership/availability has not been independently audited.

## Final-integration source identity

Owner-supplied original filename: `IMG_8842(1).png`.

Expected SHA-256: `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`.

The digest was verified against both the repository PNG and the locally served Worker asset. The original-file access blocker is resolved.

## Durable design record

The owner's request to remember the brand is implemented through versioned AFNAN-BRAND-ASSET.json, this document and AGENTS.md, rather than permanent chat memory. Future branding must preserve the original bytes and identity. Run `bun run test:branding` after branding changes.

## Reference trace and provenance

The earlier `public/brand/afnan-collection-traced.svg` is an approximation retained only as a historical reference. It is not the approved original and is not rendered by the storefront. Earlier missing-file reports predate the owner's successful PNG upload at `3ef6de5` and are superseded by the verified integration above. No merge or deployment is authorized.
