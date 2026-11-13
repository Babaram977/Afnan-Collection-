import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORIES, formatNaira, getProduct } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { ProductImageOrPlaceholder } from "@/components/site/ProductCard";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const p = await getProduct(params.slug);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Afnan Collection Online` },
          { name: "description", content: loaderData.description ?? loaderData.name },
          { property: "og:title", content: loaderData.name },
          { property: "og:description", content: loaderData.description ?? loaderData.name },
        ]
      : [
          { title: "Product unavailable — Afnan Collection Online" },
          { name: "robots", content: "noindex" },
        ],
  }),
  notFoundComponent: () => (
    <div className="container-page py-16">
      <EmptyState
        title="Product not found"
        action={
          <Button asChild>
            <Link to="/shop" search={{}}>
              Back to shop
            </Link>
          </Button>
        }
      >
        This product doesn't exist or is no longer listed.
      </EmptyState>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const p = Route.useLoaderData();
  const { add } = useCart();
  const [img, setImg] = useState(0);
  const [vid, setVid] = useState(p.variants[0]?.id);
  const v = p.variants.find((x) => x.id === vid);
  const out = v?.stock == null || v.stock <= 0;
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-2 md:py-12">
      <div>
        <div className="aspect-square overflow-hidden rounded-3xl">
          <ProductImageOrPlaceholder src={p.images[img]?.url} alt={p.images[img]?.alt ?? p.name} />
        </div>
        {p.images.length > 1 && (
          <ul className="mt-3 flex gap-2" aria-label="Gallery">
            {p.images.map((im, i) => (
              <li key={im.url}>
                <button
                  onClick={() => setImg(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-pressed={i === img}
                  className="size-16 overflow-hidden rounded-xl ring-primary aria-pressed:ring-2"
                >
                  <img src={im.url} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-primary">
          {p.categoryLabel ?? CATEGORIES.find((c) => c.slug === p.category)?.label}
        </p>
        <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{p.name}</h1>
        {v && <p className="mt-3 text-2xl font-bold">{formatNaira(v.priceKobo)}</p>}
        {p.variants.length > 1 && (
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">Option</legend>
            <div className="flex flex-wrap gap-2">
              {p.variants.map((x) => (
                <button
                  key={x.id}
                  onClick={() => setVid(x.id)}
                  aria-pressed={x.id === vid}
                  className="min-h-11 rounded-full border bg-card px-4 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {[x.size, x.color].filter(Boolean).join(" · ") || x.sku}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {v && <p className="mt-2 text-xs text-muted-foreground">SKU: {v.sku}</p>}
        {v?.stock != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            {out ? "Out of stock" : `${v.stock} in stock`}
          </p>
        )}
        <Button
          size="lg"
          className="mt-6 w-full rounded-full md:w-auto"
          disabled={!v || out}
          onClick={() => {
            if (!v) return;
            add({
              productId: p.id,
              variantId: v.id,
              name: p.name,
              variantLabel: [v.size, v.color].filter(Boolean).join(" · "),
              priceKobo: v.priceKobo,
              qty: 1,
              imageUrl: p.images[0]?.url,
            });
            toast.success("Added to cart");
          }}
        >
          Add to cart
        </Button>
        {p.description && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{p.description}</p>
          </section>
        )}
        {p.ageGuidance && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Age guidance</h2>
            <p className="mt-2 text-muted-foreground">{p.ageGuidance}</p>
          </section>
        )}
        {p.safetyNotes && (
          <section className="mt-6 rounded-2xl bg-warning p-4 text-warning-foreground">
            <h2 className="text-lg font-semibold">Safety information</h2>
            <p className="mt-1">{p.safetyNotes}</p>
          </section>
        )}
      </div>
    </div>
  );
}
