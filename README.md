# Afnan Collection Online

Children’s lifestyle storefront for clothing, essentials, toys and gifts. The Lovable UI is preserved: warm cream, cocoa and terracotta, Fraunces headings and Nunito Sans body text. [Design contract](docs/design/AFNAN-UI-STANDARD.md).

## Current state

This is a frontend storefront with TanStack Start SSR, React 19, TypeScript, TanStack Router/Query, Tailwind 4 and shadcn/Radix components. The catalog is intentionally empty: no real product records were supplied.

- Home, URL-filtered shop, product details and a localStorage cart are implemented.
- Checkout is a non-submitting preview; order placement and payments are disabled. No orders, stock reservations or payment results are created.
- Admin is a public, read-only local-data preview, without authentication or writes. It must never expose future private data before server authorization exists.
- About, contact and policies contain placeholders. No business contact, delivery terms or payment provider is confirmed.
- No database, backend commerce APIs, production hosting configuration or deployment automation is connected in this repository.

## Development

Use Node 24 and Bun (the repository includes bun.lock; no npm lockfile). Pin a tested Bun version in the future CI foundation.

```sh
git clone https://github.com/Babaram977/Afnan-Collection-.git
cd Afnan-Collection-
bun install --frozen-lockfile
bun run dev
bun run test
bunx tsc --noEmit
bun run lint
bun run build
```

`build:dev` and `preview` are also available. A successful build alone does not establish Cloudflare runtime compatibility. See the [engineering assessment](docs/engineering/INITIAL-ASSESSMENT.md) for actual validation and remaining release gates.

## Structure and ownership

- `src/routes/`: file-based pages; `src/router.tsx`: router and QueryClient.
- `src/lib/catalog.ts`: Product/Variant contracts, integer NGN kobo, local catalog seam (`listProducts` / `getProduct`). Admin and some page metadata also reference local constants and need review during backend integration.
- `src/lib/cart.tsx`: browser state, never authoritative for prices or stock.
- `src/server.ts`, `src/start.ts`: SSR error wrapper and request middleware (including server-function CSRF protection).
- `src/test/`: catalog/cart unit coverage and route matching; no browser, auth, order or payment coverage.

GitHub is authoritative for future development. Lovable performed a **one-time upload**, not automatic GitHub synchronization. Targeted Lovable design work must be reconciled manually with current GitHub code. Read [AGENTS.md](AGENTS.md) and the five [continuity records](docs/project-continuity/PROJECT-STATUS.md) before making changes.

The repository was public at initialization. Owner preference is to make it private before adding operational configuration; no visibility change is included here. Never commit secrets, including in a private repository.
