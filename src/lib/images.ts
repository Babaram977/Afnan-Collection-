/** Browser-side photo resizing for economical mobile delivery. The server still
 * validates type/size and authorizes every upload. This never processes the logo.
 */
/** Main product/banner photograph: at most 1600 px on the long edge, WebP. */
export function optimizeProductPhoto(file: File): Promise<Blob> {
  return resizePhoto(file, 1600, 0.82);
}
/**
 * Small copy for product cards, the bag and gallery buttons (displayed at most ~224 CSS px; 600 px
 * covers 2.5x screens). The full photograph is still uploaded and used on the product page.
 */
export function productCardPhoto(file: File): Promise<Blob> {
  return resizePhoto(file, 600, 0.8);
}
async function resizePhoto(file: File, maxEdge: number, quality: number): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use JPG, PNG or WebP photographs.");
  if (file.size > 20 * 1024 * 1024) throw new Error("The original photo must be under 20 MB.");
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 40_000_000)
      throw new Error("The original photo is too large.");
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Photo processing failed."))),
        "image/webp",
        quality,
      ),
    );
  } finally {
    image.close();
  }
}
export function nairaToKobo(value: string): number {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount in naira with up to two decimal places.");
  const [naira, kobo = ""] = value.split(".");
  return Number(naira) * 100 + Number(kobo.padEnd(2, "0"));
}
