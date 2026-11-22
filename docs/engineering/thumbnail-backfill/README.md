# Card-copy (thumbnail) backfill — DRY RUN, 2026-11-22

**Status: plan only. Nothing has been written to production.** No D1 writes, no R2 uploads,
deletions or replacements. Executing this plan requires separate owner authorization.

## Why

PR #36 (merged in `7fcddfc`) makes the admin store a 600 px WebP card copy (`images[].thumb`)
for every new upload, and the storefront uses it on product cards, in the bag and on gallery
buttons. The 11 photographs uploaded before that have no card copy, so the shop page still downloads
the full photographs. This plan adds card copies for them.

## How the plan was produced (read-only)

`node scripts/thumbnail-backfill-plan.mjs --out DIR` (run with `NODE_USE_ENV_PROXY=1` behind a proxy):

1. Reads product image references from the **public** catalogue, `GET /api/products`.
2. Downloads each original through the **public** `/media/` route, which serves only published
   photographs. No Cloudflare credentials are used and no access control is bypassed.
3. Makes the card copy with the same Chromium canvas resize as the admin uploader
   (`src/lib/images.ts` `productCardPhoto`: long edge 600 px, WebP quality 0.8).
4. Writes `manifest.json`, `apply.sql`, `rollback.sql` and the preview files.

The public catalogue at the time of the run matched the production baseline: 11 products,
13 options, 189 units, 11 image references, 11 distinct originals, none with a card copy.
All 11 products are published, so no draft photograph was outside the plan.

## Result

|                                                   | Bytes                    |
| ------------------------------------------------- | ------------------------ |
| 11 originals (what the shop page downloads today) | 16,081,144 B (15.34 MiB) |
| 11 card copies (what it would download)           | 454,920 B (444 KB)       |
| **Reduction**                                     | **97.2%**                |

## Manifest

Full checksums are in `manifest.json`.

| #   | Product (slug)     | Original                                             | Size          | Original SHA-256    | → Card copy key                                     | Size       | Card SHA-256        | Saving    |
| --- | ------------------ | ---------------------------------------------------- | ------------- | ------------------- | --------------------------------------------------- | ---------- | ------------------- | --------- |
| 1   | cotton-swabs       | `6a416125-af2b-48db-bfd7-decffd9e9234.png` 1080×1182 | 1,355 KB      | `5ead3c28a3fba869…` | `bc79cebf-8743-9b7b-a5e2-2139031f0c0e.webp` 548×600 | 29 KB      | `b3f72d144c2df634…` | 97.9%     |
| 2   | kids-beach-gown    | `f37331e4-c950-4916-936a-4cb86430c87e.png` 1200×1200 | 637 KB        | `ed502bc36873f808…` | `c59d1480-0a6f-b207-3f7e-36d32911329f.webp` 600×600 | 20 KB      | `92deb4436a5a8c8e…` | 96.9%     |
| 3   | girls-panty-pack   | `759d5a2e-e8ee-4126-b263-ff65e36a0ed4.png` 684×1216  | 1,253 KB      | `8474d218ce95a48e…` | `848475f1-e7f9-a65f-bae4-83cdeffdffb6.webp` 338×600 | 39 KB      | `d2b6b441bfe77ae2…` | 96.9%     |
| 4   | spirit-moko        | `15b9665b-062f-42f8-bb59-1fb060771217.png` 1080×1440 | 1,593 KB      | `9eabdc9a2aca3dff…` | `65cdc9ed-c444-5c56-4a17-e30d524c6713.webp` 450×600 | 33 KB      | `18ab1e93a92921ec…` | 97.9%     |
| 5   | nycil-menthol-rub  | `2ea09914-808c-499c-994d-940a172d5c0d.png` 1080×1182 | 1,354 KB      | `e662187819563724…` | `afa31468-085b-3193-94b8-acd26822c1d6.webp` 548×600 | 32 KB      | `d5ab7e27b22a0204…` | 97.6%     |
| 6   | demin-jeans        | `b30f89d9-8d70-44d4-8114-021789497548.png` 932×1280  | 1,675 KB      | `8fa4a8c264da465d…` | `d6e763cc-1327-d985-e944-e492b2da6033.webp` 437×600 | 50 KB      | `eb99cd36531a8244…` | 97.0%     |
| 7   | long-sleeves-shirt | `98f53721-06a4-429e-9ca3-2851f072138e.png` 1024×1280 | 1,335 KB      | `db77662021519f25…` | `11978e2b-64f3-d6e5-e4e5-f31d412a66c8.webp` 480×600 | 54 KB      | `5b4c2519e3574097…` | 95.9%     |
| 8   | mikeni-kids-gown   | `4643bf2e-719a-4533-97f6-d3086d147cd1.png` 1280×1280 | 2,506 KB      | `9c680ba06f1427a5…` | `30f4dc0c-8043-7a5b-88f4-aa9c396de5ec.webp` 600×600 | 82 KB      | `580d460fa9b3adba…` | 96.7%     |
| 9   | kids-gown          | `e829291a-4dd2-4373-99ae-13843144d378.png` 832×1280  | 760 KB        | `6c90f49784e1a140…` | `0aa0e390-e753-db65-c096-4aedea93393e.webp` 390×600 | 19 KB      | `b69bafdfe58c4a97…` | 97.5%     |
| 10  | kids-gown-with-bag | `5bc24fd1-235c-4a16-8a5f-6994db8fbc10.png` 1260×1252 | 1,027 KB      | `528c36bbcb9e5976…` | `20e7bb74-7485-a31a-db73-897cd0e2b337.webp` 600×596 | 29 KB      | `b8d89771afd60e7c…` | 97.2%     |
| 11  | chinos             | `2a087063-e0e8-419b-94fb-618aca0a6931.png` 1280×1236 | 2,210 KB      | `0d1a9099bed0a995…` | `e7d28dfe-6f7e-c63a-b641-9a3a7c8ad043.webp` 600×579 | 57 KB      | `b7638dc8cb85ca1a…` | 97.4%     |
|     | **Total (11)**     |                                                      | **15.34 MiB** |                     |                                                     | **444 KB** |                     | **97.2%** |

## Safety properties (verified)

| Property                                         | How it holds                                                                                                                                                                                                                                                                            | Verified                                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot overwrite an original                     | Card keys are `sha256("card-v1:" + original sha256)` formatted as a UUID with a `.webp` extension. All 11 originals are random UUIDv4 `.png`. The script refuses to write if a key equals any original URL. The apply step must also check that the key does not already exist (below). | Keys unique and disjoint from all originals                                                                                                              |
| Rerun creates no duplicates                      | The key derives from the original's bytes, so a rerun names the same object. The SQL only fills a missing `thumb`.                                                                                                                                                                      | Two runs: identical keys and `apply.sql` (card bytes were also identical, 11/11). On a local copy of the live image data, apply changed 11 rows, then 0. |
| Image order and original URLs preserved          | `json_set(images,'$[i].thumb',…)` adds one field at a fixed index. `url` and `alt` are untouched. `updated_at` is untouched, so the shop's "Recently updated" order is unchanged.                                                                                                       | Local simulation: url, alt and order identical for all 11                                                                                                |
| No effect if the owner changed a photo meanwhile | Each statement matches both the product id and the exact original URL at that index, and requires `thumb IS NULL`.                                                                                                                                                                      | Replaced photo: 0 rows. Owner-set thumb: 0 rows.                                                                                                         |
| Rollback is exact                                | `rollback.sql` removes only the thumb it added, using the same guards.                                                                                                                                                                                                                  | Apply then rollback restored identical JSON for all 11 products. A second rollback changed 0 rows.                                                       |

## Apply procedure (requires owner authorization — not executed)

Prerequisite: production runs `7fcddfc` or later. The order doesn't strictly matter, because the
current production Worker ignores `thumb`, but deploying first lets each step be verified as it goes.

1. **Re-plan immediately before applying**, and stop if anything differs:
   `node scripts/thumbnail-backfill-plan.mjs --out plan-<date>`. Compare its `apply.sql` and the
   original checksums with this manifest.
2. **Record the before state:**
   - `wrangler d1 execute afnan-collection-production --remote --json --command "SELECT id,images,updated_at FROM products"` → `products-before.json`.
   - For each original URL, `curl -s https://afnancollectionkn.com/media/<key> | sha256sum`, and confirm it equals `originalSha256`.
3. **Upload each card copy, refusing to overwrite.** For each item:
   - Run `wrangler r2 object get afnan-product-media-production/<thumbKey> --remote --pipe`.
   - If an object exists and its SHA-256 equals `thumbSha256`, skip the upload (this makes reruns safe).
   - If an object exists with any other content, **stop**.
   - Otherwise upload: `wrangler r2 object put afnan-product-media-production/<thumbKey> --remote --file previews/<thumbKey> --content-type image/webp`.
   - Read the object back and confirm it equals `thumbSha256`.
4. **Apply the references:** `wrangler d1 execute afnan-collection-production --remote --file apply.sql`. Expect 11 changed rows on the first run and 0 on any rerun.
5. **Verify:**
   - Every `https://afnancollectionkn.com<thumbUrl>` returns 200 with `image/webp` and the manifest checksum.
   - Every original still returns its `originalSha256`.
   - `/api/products` shows each image with the same `url` and `alt` in the same order, plus `thumb`.
   - On /shop, every card `<img>` uses its thumb and no full photograph is requested.
   - Catalogue counts are still 11 / 13 / 189.

## Rollback procedure

1. `wrangler d1 execute afnan-collection-production --remote --file rollback.sql`. The storefront
   immediately falls back to the originals; this alone fully restores behaviour.
2. Optionally delete the 11 card-copy objects, by the `thumbKey` values in this manifest only.
   **Never delete a key that is not listed under `thumbKey`.** No original is ever touched by
   apply or rollback.
3. Verify: `products` matches `products-before.json`, and the originals' checksums are unchanged.

## Not covered

- Banner photographs. Banners have no card copy and are shown full width.
- Draft products. There are none today; the public route cannot read draft photographs. A future
  draft would need an authenticated read through `/api/admin/media/` or `wrangler r2 object get`.
