# Afnan Collection Online — maintenance instructions

## Ownership and scope

- GitHub is the authoritative source. The Lovable source was uploaded once; automatic synchronization is not configured. Do not assume commits flow to or from Lovable.
- Codex handles reviewed implementation; use Lovable for targeted design proposals, then review and apply their diffs against current GitHub state.
- Preserve published history with additive commits. Do not edit generated files such as src/routeTree.gen.ts by hand.
- Preserve the storefront and docs/design/AFNAN-UI-STANDARD.md. No redesign is authorized by initialization.
- Checkout, order creation, payments and admin writes must remain disabled until explicitly authorized and validated.
- Do not merge, deploy, provision databases or change domains under this task.
- Keep secrets and customer information out of Git and continuity records, regardless of repository visibility. Use hosting secret storage for future server credentials; VITE_* values are public.
- The previous generic Lovable-managed database/secrets/synchronization instructions are superseded by this owner-authorized GitHub handoff. No backend currently exists.

## Durable project continuity

- Before development, read all five files in docs/project-continuity/ and reconcile them with current branches, PRs, reviews and exact-head CI.
- Update relevant records alongside meaningful implementation milestones. Preserve earlier decisions and record changes with reasons; distinguish verified facts, proposals and unresolved questions.
- Recover lost conversation context from these records and GitHub history. Keep each project's records separate.
- Do not create unnecessary commits, merge or deploy solely to maintain records.

## Validation

- Use the committed Bun lockfile for reproducible installs: bun install --frozen-lockfile. Do not introduce a competing lockfile casually.
- Run tests, TypeScript checking, lint and production build as appropriate; record failures honestly. Do not bulk-format the existing storefront to clean up unrelated baseline lint findings.
- vite.config.ts wraps framework plugins already supplied by @lovable.dev/vite-tanstack-config; do not duplicate them or externalize Worker runtime dependencies.

## Project rules

- Catalog data flows only through `src/lib/catalog.ts` (`listProducts`/`getProduct`); swap these for API calls when a backend exists, keeping the types — keeps backend handoff a single seam.
- Money is integer kobo formatted with `formatNaira` — avoids float errors and keeps NGN display consistent.
- Cart is client-only context in `src/lib/cart.tsx`; server must recompute prices at order time.
- UI contract documented in `docs/design/AFNAN-UI-STANDARD.md`; update it with any route/token/API change.
