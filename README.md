# Afnan Collection Online

A mobile-first Nigerian children's lifestyle storefront for newborns, babies, toddlers and older children. Designed for a friendly, clear shopping experience with warm cream surfaces, muted cheerful accents and Nigerian naira pricing.

Afnan Collection Online is a separate business from Heroine Collection and Afnan Homes. The storefront currently uses an elegant text wordmark; no official logo or tagline has been supplied.

## Current status

**Frontend foundation — not a live, order-taking store.**

The catalog is intentionally empty because real product records have not been supplied. No products, prices, stock, photographs, reviews, discounts, contact details, delivery promises or payment results are fabricated. Neutral image placeholders are not merchandise photographs.

| Available now | Not connected yet |
| --- | --- |
| Homepage with age-group and category navigation | Product database and inventory synchronization |
| Shop search and age, category, size and price filters | Customer sign-in and protected administration |
| Product detail layouts with variants and galleries, ready for real records | Payments and order processing |
| Browser-local cart with quantity changes and removal | Checkout submission and delivery calculations |
| Mobile navigation and accessible UI controls | Product, inventory, order and banner management |

Product browsing and cart controls are implemented, but shoppers cannot exercise a purchase flow until verified catalog data is added. Featured and seasonal sections appear only when corresponding product records exist. Checkout submission and administrative writes are disabled and labelled **not connected**. About, contact and policy pages await approved business content.

## Catalog scope

- Clothing, shoes and accessories
- Diapers and feeding accessories
- Blankets and nursery essentials
- Toys and learning products
- Books, bath and care accessories
- School essentials and gifts

These are navigation categories, not a claim that items are currently available. Age-group navigation is separate from product-specific suitability or safety guidance, which must come from factual product information.

## Technology

- React 19 and TypeScript
- TanStack Start and TanStack Router
- Vite and Tailwind CSS v4
- Reusable shadcn/ui and Radix UI controls
- Vitest and Testing Library
- Bun dependency lockfile

## Local development

Install a current Node.js LTS release and [Bun](https://bun.sh). Then:

```sh
git clone https://github.com/Babaram977/Afnan-Collection-.git
cd Afnan-Collection-
bun install --frozen-lockfile
bun run dev
```

Open the local address printed by Vite. The current frontend does not require payment credentials or a connected database.

### Commands

```sh
bun run test        # Run the test suite
bun run test:watch  # Run tests in watch mode
bun run lint        # Check code quality
bun run build       # Create a production build
bun run preview     # Preview the production build locally
```

Building or previewing locally does not publish the store.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Homepage and age/category entry points |
| `/shop` | Catalog search and filters stored in the URL |
| `/product/$slug` | Product details for an existing record |
| `/cart` | Browser-local shopping cart |
| `/checkout` | Checkout form shell; ordering disabled |
| `/about` | Placeholder for approved business information |
| `/contact` | Placeholder for verified contact details |
| `/policies` | Placeholder for approved policies |
| `/admin` | Read-only administration preview; no authentication or writes |

The admin page is not a secure management system. Do not place private customer or operational data there before access controls are implemented.

## Project structure

```text
src/
  components/site/   Shared storefront elements
  components/ui/     Reusable UI primitives
  lib/catalog.ts    Product types, filters and catalog access
  lib/cart.tsx      Client-only cart context
  routes/           Storefront and administration pages
  styles.css        Global styles and semantic design tokens
  test/             Automated tests
docs/design/
  AFNAN-UI-STANDARD.md
AGENTS.md           Contributor and implementation rules
```

## Data and backend handoff

All catalog access goes through `listProducts()` and `getProduct()` in `src/lib/catalog.ts`. Replace these implementations with API-backed reads while preserving the product types and storefront contract.

- Store money as **integer kobo** and display it with `formatNaira` in NGN.
- Treat browser cart totals as display-only. A future order service must recompute prices and validate stock on the server.
- Supply verified product records, variant details, stock and authentic photographs before populating the catalog.
- Render descriptions, age guidance and safety notes only when factual information is available.
- Add authentication, authorization, persistent inventory, order processing and payment verification before enabling checkout or administrative writes.
- Never store secret keys in source code or expose them to browser code.

The [UI Standard](docs/design/AFNAN-UI-STANDARD.md) documents the implemented tokens, components, routes, product model and **proposed, not implemented** API contracts. Read [AGENTS.md](AGENTS.md) before changing the architecture. Update the UI Standard when routes, tokens or API contracts change.

## Before launch

- [ ] Supply and verify the real product catalog and photographs.
- [ ] Approve business information, contact details and policy wording.
- [ ] Supply the official logo if replacing the text wordmark.
- [ ] Connect persistent catalog, inventory and order services.
- [ ] Implement secure customer and administrator access where needed.
- [ ] Connect and verify payments, order confirmation and fulfilment workflows.
- [ ] Test the complete shopping flow on mobile and desktop with real data.
- [ ] Obtain owner approval before publishing or deploying.

## Repository and publishing

Source repository: [Babaram977/Afnan-Collection-](https://github.com/Babaram977/Afnan-Collection-).

The initial source upload was a one-time GitHub transfer, not a verified two-way Lovable Git sync connection. Do not assume future Lovable changes appear here automatically. Publishing and deployment require a separate, explicit owner request.

## License

No license has been declared in this repository. Public source visibility alone does not grant permission to reuse the code, brand or business assets.