#!/usr/bin/env node
// One-time card-copy backfill — DRY RUN / PLAN ONLY (2026-11-22).
//
// Photos uploaded before PR #36 have no `thumb`, so product cards still download the full
// photograph. This script PLANS a backfill and changes nothing anywhere:
//   - reads product image references from the public catalogue (GET /api/products),
//   - downloads each original through the public /media/ route (published photos only),
//   - makes the 600 px WebP card copy with the same browser canvas resize as the admin uploader
//     (src/lib/images.ts productCardPhoto: long edge 600 px, WebP quality 0.8),
//   - writes the previews, an itemized manifest, and the guarded SQL that an AUTHORIZED apply
//     step would run, to an output directory.
// It never writes to D1 or R2 and holds no Cloudflare credentials.
//
// Usage: node scripts/thumbnail-backfill-plan.mjs [--origin https://afnancollectionkn.com] --out DIR
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const ORIGIN = arg("origin", "https://afnancollectionkn.com");
const OUT = arg("out");
if (!OUT) throw new Error("--out DIR is required");
const MAX_EDGE = 600;
const QUALITY = 0.8;
const VERSION = "card-v1";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Deterministic key from the ORIGINAL's bytes: rerunning the plan (or the apply) names the same
// object, so it can never create a second copy, and the key cannot equal an original's key
// (originals are random UUIDv4 .png/.jpg; this is a hash-derived .webp).
export function thumbKeyFor(originalSha256) {
  const h = sha256(`${VERSION}:${originalSha256}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}.webp`;
}
const sql = (s) => `'${String(s).replaceAll("'", "''")}'`;

const catalog = await (await fetch(`${ORIGIN}/api/products`)).json();
await mkdir(join(OUT, "previews"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");
const items = [];
try {
  for (const product of catalog) {
    for (const [index, image] of product.images.entries()) {
      const item = {
        productId: product.id,
        slug: product.slug,
        imageIndex: index,
        originalUrl: image.url,
        alt: image.alt,
      };
      items.push(item);
      if (image.thumb) {
        item.action = "skip: already has a card copy";
        item.existingThumb = image.thumb;
        continue;
      }
      const response = await fetch(`${ORIGIN}${image.url}`);
      if (!response.ok) {
        item.action = `blocked: original returned HTTP ${response.status}`;
        continue;
      }
      const original = Buffer.from(await response.arrayBuffer());
      item.originalContentType = response.headers.get("content-type");
      item.originalBytes = original.length;
      item.originalSha256 = sha256(original);
      const out = await page.evaluate(
        async ({ b64, type, maxEdge, quality }) => {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type }));
          const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(bitmap.width * scale);
          canvas.height = Math.round(bitmap.height * scale);
          canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
          const buf = new Uint8Array(await blob.arrayBuffer());
          let s = "";
          for (const x of buf) s += String.fromCharCode(x);
          return {
            width: bitmap.width,
            height: bitmap.height,
            thumbWidth: canvas.width,
            thumbHeight: canvas.height,
            b64: btoa(s),
          };
        },
        {
          b64: original.toString("base64"),
          type: item.originalContentType,
          maxEdge: MAX_EDGE,
          quality: QUALITY,
        },
      );
      const thumb = Buffer.from(out.b64, "base64");
      Object.assign(item, {
        originalWidth: out.width,
        originalHeight: out.height,
        thumbWidth: out.thumbWidth,
        thumbHeight: out.thumbHeight,
        thumbBytes: thumb.length,
        thumbSha256: sha256(thumb),
        thumbKey: thumbKeyFor(item.originalSha256),
      });
      item.thumbUrl = `/media/${item.thumbKey}`;
      if (`/media/${item.thumbKey}` === image.url) throw new Error("Key collision with original");
      item.preview = `previews/${item.thumbKey}`;
      item.action = "plan: upload card copy, then add thumb reference";
      await writeFile(join(OUT, item.preview), thumb);
    }
  }
} finally {
  await browser.close();
}

const planned = items.filter((i) => i.thumbKey);
const keys = new Set(planned.map((i) => i.thumbKey));
const originals = new Set(items.map((i) => i.originalUrl));
if (keys.size !== new Set(planned.map((i) => i.originalSha256)).size)
  throw new Error("Thumbnail keys are not unique per original");
for (const k of keys) if (originals.has(`/media/${k}`)) throw new Error(`Key ${k} is an original`);

const totals = {
  products: catalog.length,
  imageReferences: items.length,
  distinctOriginals: originals.size,
  planned: planned.length,
  skipped: items.filter((i) => i.action.startsWith("skip")).length,
  blocked: items.filter((i) => i.action.startsWith("blocked")).length,
  originalBytes: planned.reduce((n, i) => n + i.originalBytes, 0),
  thumbBytes: planned.reduce((n, i) => n + i.thumbBytes, 0),
};
totals.reductionPercent = totals.originalBytes
  ? Number((100 * (1 - totals.thumbBytes / totals.originalBytes)).toFixed(1))
  : 0;

// Guarded, idempotent SQL for the AUTHORIZED apply step (not executed by this script). Each
// statement only fills a missing thumb at that exact position with that exact original URL, so it
// preserves order and URLs, does nothing on a rerun, and does nothing if the owner has since
// changed the photo. updated_at is deliberately untouched (the shop's "Recently updated" order).
const where = (i) =>
  `id=${sql(i.productId)} AND json_extract(images,'$[${i.imageIndex}].url')=${sql(i.originalUrl)}`;
const apply = planned.map(
  (i) =>
    `UPDATE products SET images=json_set(images,'$[${i.imageIndex}].thumb',${sql(i.thumbUrl)}) WHERE ${where(i)} AND json_extract(images,'$[${i.imageIndex}].thumb') IS NULL;`,
);
const rollback = planned.map(
  (i) =>
    `UPDATE products SET images=json_remove(images,'$[${i.imageIndex}].thumb') WHERE ${where(i)} AND json_extract(images,'$[${i.imageIndex}].thumb')=${sql(i.thumbUrl)};`,
);
const manifest = {
  generatedAt: new Date().toISOString(),
  mode: "dry-run",
  origin: ORIGIN,
  resize: { maxEdge: MAX_EDGE, format: "image/webp", quality: QUALITY, keyVersion: VERSION },
  totals,
  items,
};
await writeFile(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(join(OUT, "apply.sql"), `${apply.join("\n")}\n`);
await writeFile(join(OUT, "rollback.sql"), `${rollback.join("\n")}\n`);
console.log(JSON.stringify(totals));
