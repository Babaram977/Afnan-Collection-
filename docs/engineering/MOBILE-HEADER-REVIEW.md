# Compact mobile storefront header — 2026-11-17

## Scope and reconciliation

Started from main `a645ba7` on `fix/compact-mobile-header`. Remote branches, open PRs and header history were reviewed. Claude's previous `0365bb8` compacted administrator pages only (merged PR #20); no unfinished storefront-header PR, branch or local changes were present. Preserve that administrator work and the current storefront implementation.

The storefront header below 1024 px is now 88 px including its border (previously 145 px). Desktop remains 145 px; administrator pages remain 65 px. Logo width stays 112 px. An 80 px viewport hides only blank vertical canvas around the original PNG, with the complete artwork visible. The original file SHA-256 remains `d40111efc2f469b37ee871500202ab33da1e4c128593a1f8a6757ac82f96cdc1`. No logo asset, brand token, navigation destination, merchandise, price, inventory, authentication, checkout or payment setting changed.

## Rendered measurements

Local Chromium, CSS pixels, one fixture product, no real customer data:

| Viewport | Header before → after | First product top before → after |
| --- | --- | --- |
| 320 × 568 | 145 → 88 | 580 → 523 |
| 375 × 667 | 145 → 88 | 580 → 523 |
| 390 × 844 | 145 → 88 | 580 → 523 |
| 393 × 852 | 145 → 88 | 580 → 523 |
| 430 × 932 | 145 → 88 | 556 → 499 |
| 844 × 390, landscape | 145 → 88 | 592 → 535 |
| 768 × 1024 | 145 → 88 | 592 → 535 |
| 1023 × 900 | 145 → 88 | 592 → 535 |
| 1024 × 900 | 145 → 145 | 434 → 434 |
| 1440 × 1000 | 145 → 145 | 434 → 434 |

The first product moves 57 px upward on mobile. The full fixture card is visible on the 390 × 844 screenshot without scrolling. Very short screens and landscape still require scrolling through the existing shop controls. The complete 1440 px shop screenshot is pixel-identical before/after. Visual review confirms all original logo artwork is visible and the menu/cart remain balanced.

## Validation and evidence

- Frozen install, typecheck, lint (0 errors; 10 existing warnings), 27 unit tests, Worker build/packaging dry-run: passed.
- New `test:mobile-header`: 169 Chromium checks across ten viewports (baseline: 146). Checks include header geometry, source artwork visibility, proportions, 44 px targets, menu links/Escape/navigation dismissal, cart navigation, no horizontal overflow, header Axe accessibility and unchanged administrator height.
- Existing branding: 88; administrator dashboard: 87; shopping: 44; cart flow: 59 checks passed.
- Security audit passed with the existing owner-approved build-only picomatch advisory exception `GHSA-fc5q-39xc-vjpf`, expiring 2026-12-01. Registry latest confirmed 4.0.7; no affected code found in the 28 deployed artifact files. No exception was added or expanded.
- Before/after PNGs and JSON measurements are in `/workspace/work/afnan-header-review`, named `before-shop-390.png`, `after-shop-390.png`, etc.; screenshots use local fixtures. PR CI uploads after screenshots and runs Chromium plus WebKit. Local WebKit could not launch because host GTK/Graphene and related libraries are absent; real iPhone Safari has not been tested.
- Browser regression waits now require destination page content after navigation and wait for the existing shopping Add to cart enabled state after a colour selection. These address observed asynchronous test races without changing application or commerce behavior.
- Exact commit CI and acceptance deployment results will be recorded in the PR after pushing. This review does not claim hosted authenticated rendering.

## Acceptance and rollback

Deploy the exact validated branch SHA through main's existing `deploy-acceptance.yml` workflow, with `acceptance_checkout=disabled` and `email_sender=verified`, preserving current bindings and authentication settings. No merge or production deployment is authorized. The workflow checks for pending migrations and records the previous Worker version. Roll back acceptance to that previous version if validation fails; do not apply migrations or change Access/DNS to troubleshoot this presentation change.

Anonymous requests must continue to meet Cloudflare Access. Hosted visual checks require an existing authorized session; do not issue credentials or change policies for this task. Other businesses remain untouched.
