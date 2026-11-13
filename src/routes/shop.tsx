import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AGE_GROUPS, CATEGORIES, PRODUCTS, allSizes, filterProducts, type AgeGroup, type CategorySlug, type ProductFilters } from "@/lib/catalog";
import { ProductGrid } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";
import { PageHeader } from "@/components/site/PageHeader";

const ages = AGE_GROUPS.map((a) => a.slug) as string[];
const cats = CATEGORIES.map((c) => c.slug) as string[];
const num = (v: unknown) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v));

export const Route = createFileRoute("/shop")({
  validateSearch: (s: { q?: unknown; age?: unknown; category?: unknown; size?: unknown; minNaira?: unknown; maxNaira?: unknown }): ProductFilters => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    age: ages.includes(s.age as string) ? (s.age as AgeGroup) : undefined,
    category: cats.includes(s.category as string) ? (s.category as CategorySlug) : undefined,
    size: typeof s.size === "string" && s.size ? s.size : undefined,
    minNaira: num(s.minNaira),
    maxNaira: num(s.maxNaira),
  }),
  head: () => ({ meta: [
    { title: "Shop — Afnan Collection Online" },
    { name: "description", content: "Browse children's clothing, shoes, nursery, toys, books and school essentials by age, category, size and price." },
    { property: "og:title", content: "Shop — Afnan Collection Online" },
    { property: "og:description", content: "Browse children's products by age, category, size and price." },
  ] }),
  component: Shop,
});

const selectCls = "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Shop() {
  const f = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const set = (patch: Partial<ProductFilters>) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const results = filterProducts(PRODUCTS, f);
  const sizes = allSizes(PRODUCTS);
  const active = Object.values(f).some((v) => v !== undefined);

  return (
    <>
      <PageHeader title="Shop" intro="Search and filter by age, category, size and price." />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[260px_1fr]">
        <aside aria-label="Filters" className="space-y-5">
          <div>
            <Label htmlFor="q">Search</Label>
            <div className="relative mt-1.5"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="q" type="search" className="h-11 bg-card pl-9" placeholder="e.g. romper, blanket" defaultValue={f.q ?? ""} onChange={(e) => set({ q: e.target.value || undefined })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div><Label htmlFor="age">Age</Label>
              <select id="age" className={`${selectCls} mt-1.5`} value={f.age ?? ""} onChange={(e) => set({ age: (e.target.value || undefined) as AgeGroup | undefined })}>
                <option value="">All ages</option>{AGE_GROUPS.map((a) => <option key={a.slug} value={a.slug}>{a.label} ({a.range})</option>)}
              </select></div>
            <div><Label htmlFor="cat">Category</Label>
              <select id="cat" className={`${selectCls} mt-1.5`} value={f.category ?? ""} onChange={(e) => set({ category: (e.target.value || undefined) as CategorySlug | undefined })}>
                <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select></div>
            <div><Label htmlFor="size">Size</Label>
              <select id="size" className={`${selectCls} mt-1.5`} value={f.size ?? ""} disabled={!sizes.length} onChange={(e) => set({ size: e.target.value || undefined })}>
                <option value="">{sizes.length ? "All sizes" : "No sizes yet"}</option>{sizes.map((s) => <option key={s}>{s}</option>)}
              </select></div>
            <fieldset className="col-span-2 lg:col-span-1"><legend className="text-sm font-medium">Price (₦)</legend>
              <div className="mt-1.5 flex gap-2">
                <Input aria-label="Minimum price in naira" inputMode="numeric" type="number" min={0} placeholder="Min" className="h-11 bg-card" defaultValue={f.minNaira ?? ""} onChange={(e) => set({ minNaira: num(e.target.value) })} />
                <Input aria-label="Maximum price in naira" inputMode="numeric" type="number" min={0} placeholder="Max" className="h-11 bg-card" defaultValue={f.maxNaira ?? ""} onChange={(e) => set({ maxNaira: num(e.target.value) })} />
              </div></fieldset>
          </div>
          {active && <Button variant="outline" className="w-full" asChild><Link to="/shop" search={{}}><X /> Clear filters</Link></Button>}
        </aside>
        <section aria-live="polite" aria-label="Results">
          <p className="mb-4 text-sm text-muted-foreground">{results.length} product{results.length === 1 ? "" : "s"}</p>
          {results.length ? <ProductGrid products={results} /> : PRODUCTS.length === 0
            ? <EmptyState title="No products yet">The catalogue is empty. Products added by the store team will be listed here.</EmptyState>
            : <EmptyState title="No matches" action={<Button asChild variant="outline"><Link to="/shop" search={{}}>Clear filters</Link></Button>}>Try a different search or remove a filter.</EmptyState>}
        </section>
      </div>
    </>
  );
}
