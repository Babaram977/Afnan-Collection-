import { business } from "@/lib/business";
import { loadCategories } from "@/lib/store";
import { StoreBanners } from "@/components/site/StoreContent";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Baby,
  BookOpen,
  Gift,
  Shirt,
  ShowerHead,
  Sparkles,
  Footprints,
  Backpack,
  Milk,
  BedDouble,
  Puzzle,
  Watch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGE_GROUPS, CATEGORIES, listProducts, type CategorySlug } from "@/lib/catalog";
import { ProductGrid } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Afnan Collection Online — Children's Lifestyle Store" },
      {
        name: "description",
        content:
          "Shop clothing, shoes, nursery essentials, toys, books and gifts for newborns to older kids in Nigeria.",
      },
      { property: "og:title", content: "Afnan Collection Online" },
      ...(business.logoUrl
        ? [
            { property: "og:image", content: new URL(business.logoUrl, business.website).href },
            { property: "og:image:alt", content: "Official Afnan Collection gold AC logo" },
            { property: "og:image:type", content: "image/png" },
            { property: "og:image:width", content: "460" },
            { property: "og:image:height", content: "546" },
            { name: "twitter:card", content: "summary" },
            { name: "twitter:image", content: new URL(business.logoUrl, business.website).href },
            { name: "twitter:image:alt", content: "Official Afnan Collection gold AC logo" },
          ]
        : []),
      {
        property: "og:description",
        content: "Clothing, essentials, toys and gifts for newborns to older kids in Nigeria.",
      },
    ],
  }),
  loader: async () => ({ products: await listProducts(), categories: await loadCategories() }),
  component: Home,
});

const ICONS: Record<CategorySlug, typeof Shirt> = {
  clothing: Shirt,
  shoes: Footprints,
  accessories: Watch,
  diapers: Baby,
  feeding: Milk,
  nursery: BedDouble,
  toys: Puzzle,
  books: BookOpen,
  "bath-care": ShowerHead,
  school: Backpack,
  gifts: Gift,
};

function Home() {
  const { products: PRODUCTS, categories: CATEGORIES } = Route.useLoaderData();
  const featured = PRODUCTS.filter((p) => p.featured);
  const seasonal = PRODUCTS.filter((p) => p.seasonal);
  return (
    <>
      <section className="border-b bg-secondary/60">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.3fr_1fr] md:items-center md:py-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              For little ones & growing kids
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-6xl">
              Everything your child needs, thoughtfully chosen.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              Clothing, nursery essentials, toys, books and school supplies — from newborn to school
              age.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/shop" search={{}}>
                  Shop all <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-card">
                <Link to="/about">About us</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3" aria-hidden>
            {AGE_GROUPS.map((a) => (
              <div key={a.slug} className={`${a.tone} aspect-square rounded-3xl p-4`}>
                <span className="font-display text-lg">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StoreBanners />
      <section className="container-page py-12" aria-labelledby="age-h">
        <h2 id="age-h" className="text-2xl font-semibold md:text-3xl">
          Shop by age
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {AGE_GROUPS.map((a) => (
            <li key={a.slug}>
              <Link
                to="/shop"
                search={{ age: a.slug }}
                className={`${a.tone} block rounded-2xl p-5 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                <span className="block font-display text-xl font-semibold">{a.label}</span>
                <span className="text-sm text-foreground/75">{a.range}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pb-12" aria-labelledby="cat-h">
        <h2 id="cat-h" className="text-2xl font-semibold md:text-3xl">
          Shop by category
        </h2>
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {CATEGORIES.map((c) => {
            const I = ICONS[c.slug] ?? Puzzle;
            return (
              <li key={c.slug}>
                <Link
                  to="/shop"
                  search={{ category: c.slug }}
                  className="flex h-full flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center shadow-soft transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <I className="size-6 text-primary" aria-hidden />
                  <span className="text-xs font-semibold sm:text-sm">{c.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {featured.length > 0 && (
        <section className="container-page pb-12">
          <h2 className="mb-6 text-2xl font-semibold">Featured</h2>
          <ProductGrid products={featured} />
        </section>
      )}
      {seasonal.length > 0 && (
        <section className="container-page pb-12">
          <h2 className="mb-6 text-2xl font-semibold">This season</h2>
          <ProductGrid products={seasonal} />
        </section>
      )}
      {PRODUCTS.length === 0 && (
        <section className="container-page pb-4">
          <EmptyState
            title="Our collection is being prepared"
            icon={<Sparkles className="size-7" />}
          >
            New products will appear here as soon as they are added to the catalogue.
          </EmptyState>
        </section>
      )}
    </>
  );
}
