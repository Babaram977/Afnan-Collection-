/** Owner-supplied business information, received 2026-11-13.
 * Registration/tax identifiers are recorded as supplied, not independently verified.
 * The original PNG is checksum-verified; keep its bytes and identity unchanged.
 */
export const business = {
  name: "Afnan Collection",
  siteName: "Afnan Collection Online",
  domain: "afnancollectionkn.com",
  website: "https://afnancollectionkn.com",
  address: "11 Shehu Naallah Street, Hadejia Road, Kano, Nigeria",
  whatsapp: "+2347035963225",
  whatsappDisplay: "+234 703 596 3225",
  whatsappUrl: "https://wa.me/2347035963225",
  instagram: "https://www.instagram.com/afnan_collectionkn",
  tiktok: "https://www.tiktok.com/@afnan_collectionkn",
  socialHandle: "@afnan_collectionkn",
  cacBusinessNumber: "BN 4050963",
  tin: "24511952-001",
  registrationVerification: "Owner-supplied; not independently verified",
  // Exact owner-provided PNG, SHA-256 verified; never substitute the traced reference.
  logoUrl: "/brand/IMG_8842(1).png" as string | null,
} as const;

export type BusinessConfig = {
  [K in keyof typeof business]: K extends "logoUrl" ? string | null : string;
};
