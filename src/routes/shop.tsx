import { loadCategories } from "@/lib/store";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AGE_GROUPS,
  CATEGORIES,
  listProducts,
  allSizes,
  priceRange,
  filterProducts,
  type AgeGroup,
  type CategorySlug,
  type ProductFilters,
} from "@/lib/catalog";
import { ProductGrid } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { PageHeader } from "@/components/site/PageHeader";

const ages = AGE_GROUPS.map((a) => a.slug) as string[];
const cats = CATEGORIES.map((c) => c.slug) as string[];
const num = (v: unknown) =>
  v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v);

export const Route = createFileRoute("/shop")({
  validateSearch: (s: {
    q?: unknown;
    age?: unknown;
    category?: unknown;
    size?: unknown;
    minNaira?: unknown;
    maxNaira?: unknown;
  }): ProductFilters => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    age: ages.includes(s.age as string) ? (s.age as AgeGroup) : undefined,
    category:
      typeof s.category === "string" && /^[a-z0-9-]+$/.test(s.category)
        ? (s.category as CategorySlug)
        : undefined,
    size: typeof s.size === "string" && s.size ? s.size : undefined,
    minNaira: num(s.minNaira),
    maxNaira: num(s.maxNaira),
  }),
  head: () => ({
    meta: [
      { title: "Shop — Afnan Collection Online" },
      {
        name: "description",
        content:
          "Browse children's clothing, shoes, nursery, toys, books and school essentials by age, category, size and price.",
      },
      { property: "og:title", content: "Shop — Afnan Collection Online" },
      {
        property: "og:description",
        content: "Browse children's products by age, category, size and price.",
      },
    ],
  }),
  loader: async () => ({ products: await listProducts(), categories: await loadCategories() }),
  component: Shop,
});

const selectCls =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Shop() {
  const { products: PRODUCTS, categories: CATEGORIES } = Route.useLoaderData();
  const [sort, setSort] = useState("newest");
  const f = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const set = (patch: Partial<ProductFilters>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const results = filterProducts(PRODUCTS, f).sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "low"
        ? (priceRange(a)?.min ?? 0) - (priceRange(b)?.min ?? 0)
        : sort === "high"
          ? (priceRange(b)?.min ?? 0) - (priceRange(a)?.min ?? 0)
          : 0,
  );
  const sizes = allSizes(PRODUCTS);
  const active = Object.values(f).some((v) => v !== undefined);
  // Filters other than search, for the phone "Filters" button badge.
  const panelActive = [f.age, f.category, f.size, f.minNaira, f.maxNaira].filter(
    (v) => v !== undefined,
  ).length;
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Category chips list only categories that currently have products.
  const stocked = CATEGORIES.filter((c) => PRODUCTS.some((p) => p.category === c.slug));

  return (
    <>
      <PageHeader title="Shop" intro="Search and filter by age, category, size and price." />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr] lg:gap-8 lg:py-8">
        <aside aria-label="Filters" className="min-w-0 space-y-4 lg:space-y-5">
          <div>
            <Label htmlFor="q">Search</Label>
            <div className="relative mt-1.5">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="q"
                type="search"
                className="h-11 bg-card pl-9"
                placeholder="e.g. romper, blanket"
                value={f.q ?? ""}
                onChange={(e) => set({ q: e.target.value || undefined })}
              />
            </div>
          </div>
          {stocked.length > 1 && (
            <div
              role="group"
              aria-label="Shop by category"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden"
            >
              {[{ slug: undefined, label: "All" }, ...stocked].map((c) => (
                <button
                  key={c.slug ?? "all"}
                  type="button"
                  aria-pressed={f.category === c.slug}
                  onClick={() => set({ category: c.slug as CategorySlug | undefined })}
                  className="min-h-10 shrink-0 rounded-full border bg-card px-4 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between lg:hidden"
            aria-expanded={filtersOpen}
            aria-controls="shop-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              {filtersOpen ? "Hide filters" : "Filters"}
            </span>
            {panelActive > 0 && (
              <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                {panelActive}
              </span>
            )}
          </Button>
          <div
            id="shop-filters"
            className={`grid-cols-2 gap-3 lg:grid lg:grid-cols-1 ${filtersOpen ? "grid" : "hidden"}`}
          >
            <div>
              <Label htmlFor="age">Age</Label>
              <select
                id="age"
                className={`${selectCls} mt-1.5`}
                value={f.age ?? ""}
                onChange={(e) =>
                  set({ age: (e.target.value || undefined) as AgeGroup | undefined })
                }
              >
                <option value="">All ages</option>
                {AGE_GROUPS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label} ({a.range})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                className={`${selectCls} mt-1.5`}
                value={f.category ?? ""}
                onChange={(e) =>
                  set({ category: (e.target.value || undefined) as CategorySlug | undefined })
                }
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="size">Size</Label>
              <select
                id="size"
                className={`${selectCls} mt-1.5`}
                value={f.size ?? ""}
                disabled={!sizes.length}
                onChange={(e) => set({ size: e.target.value || undefined })}
              >
                <option value="">{sizes.length ? "All sizes" : "No sizes yet"}</option>
                {sizes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <fieldset className="col-span-2 lg:col-span-1">
              <legend className="text-sm font-medium">Price (₦)</legend>
              <div className="mt-1.5 flex gap-2">
                <Input
                  aria-label="Minimum price in naira"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  placeholder="Min"
                  className="h-11 bg-card"
                  value={f.minNaira ?? ""}
                  onChange={(e) => set({ minNaira: num(e.target.value) })}
                />
                <Input
                  aria-label="Maximum price in naira"
                  inputMode="numeric"
                  type="number"
                  min={0}
                  placeholder="Max"
                  className="h-11 bg-card"
                  value={f.maxNaira ?? ""}
                  onChange={(e) => set({ maxNaira: num(e.target.value) })}
                />
              </div>
            </fieldset>
          </div>
          {active && (
            <Button variant="outline" className="w-full" asChild>
              <Link to="/shop" search={{}}>
                <X /> Clear filters
              </Link>
            </Button>
          )}
        </aside>
        <section aria-live="polite" aria-label="Results">
          <div className="mb-4 flex items-end justify-between gap-3">
            <p className="pb-2.5 text-sm text-muted-foreground">
              {results.length} product{results.length === 1 ? "" : "s"}
            </p>
            <div className="w-44 sm:w-52">
              <Label htmlFor="sort" className="text-xs">
                Sort by
              </Label>
              <select
                id="sort"
                className={`${selectCls} mt-1`}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Recently updated</option>
                <option value="name">Name</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </div>
          </div>
          {results.length ? (
            <ProductGrid products={results} />
          ) : PRODUCTS.length === 0 ? (
            <EmptyState title="No products yet">
              The catalogue is empty. Products added by the store team will be listed here.
            </EmptyState>
          ) : (
            <EmptyState
              title="No matches"
              action={
                <Button asChild variant="outline">
                  <Link to="/shop" search={{}}>
                    Clear filters
                  </Link>
                </Button>
              }
            >
              Try a different search or remove a filter.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
