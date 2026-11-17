import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, formatNaira, getProduct } from "@/lib/catalog";
import { useCart } from "@/lib/cart";
import { choicesOf, lineNote } from "@/lib/options";
import { ProductOptions } from "@/components/site/ProductOptions";
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
  const { add, ready, error: cartError } = useCart();
  const [img, setImg] = useState(0);
  const [vid, setVid] = useState(p.variants[0]?.id);
  const [choice, setChoice] = useState<{ size?: string; color?: string }>({});
  const [note, setNote] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const v = p.variants.find((x) => x.id === vid);
  const out = v?.stock == null || v.stock <= 0;
  const needsSize = choicesOf(v?.size).length > 0 && !choice.size;
  const needsColor = choicesOf(v?.color).length > 0 && !choice.color;
  return (
    <div className="container-page grid gap-8 py-8 md:grid-cols-2 md:py-12">
      <div className="min-w-0">
        <div className="aspect-square overflow-hidden rounded-3xl">
          <ProductImageOrPlaceholder src={p.images[img]?.url} alt={p.images[img]?.alt ?? p.name} />
        </div>
        {p.images.length > 1 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Gallery">
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
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">
          {p.categoryLabel ?? CATEGORIES.find((c) => c.slug === p.category)?.label}
        </p>
        <h1 className="mt-1 break-words text-3xl font-semibold md:text-4xl">{p.name}</h1>
        {v && (
          <div className="mt-3">
            {v.salePriceKobo != null && v.regularPriceKobo && (
              <p className="text-sm text-muted-foreground">
                Regular price: <del>{formatNaira(v.regularPriceKobo)}</del>
              </p>
            )}
            <p className="text-2xl font-bold">{formatNaira(v.priceKobo)}</p>
          </div>
        )}
        <ProductOptions
          variants={p.variants}
          variantId={vid}
          onVariant={(id) => {
            setVid(id);
            setAdded(null);
          }}
          choice={choice}
          onChoice={(c) => {
            setChoice(c);
            setAdded(null);
          }}
        />
        {v && <p className="mt-2 text-xs text-muted-foreground">SKU: {v.sku}</p>}
        {v?.stock != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            {out ? "Out of stock" : `${v.stock} in stock`}
          </p>
        )}
        {v && !out && (
          <div className="mt-5">
            <Label htmlFor="item-note">Note for this item (optional)</Label>
            <Input
              id="item-note"
              value={note}
              maxLength={120}
              placeholder="e.g. age 6, or a second colour choice"
              onChange={(e) => {
                setNote(e.target.value);
                setAdded(null);
              }}
            />
          </div>
        )}
        <Button
          size="lg"
          className="mt-6 w-full rounded-full md:w-auto"
          disabled={!ready || !v || out || needsSize || needsColor}
          onClick={() => {
            if (!ready || !v || needsSize || needsColor) return;
            const lineText = lineNote(choice, note);
            add({
              productId: p.id,
              variantId: v.id,
              name: p.name,
              variantLabel: [v.size, v.color].filter(Boolean).join(" · "),
              priceKobo: v.priceKobo,
              qty: 1,
              imageUrl: p.images[0]?.url,
              ...(lineText ? { note: lineText } : {}),
            });
            setAdded(lineText ? `${p.name} (${lineText})` : p.name);
          }}
        >
          {needsSize ? "Choose a size" : needsColor ? "Choose a colour" : "Add to cart"}
        </Button>
        {added && (
          <div
            role="status"
            data-added-to-cart
            className="mt-4 rounded-2xl border border-primary/30 bg-card p-4"
          >
            <p className="text-sm">
              <span className="font-semibold">Added to your cart:</span> {added}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/cart">View cart</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/shop" search={{}}>
                  Continue shopping
                </Link>
              </Button>
            </div>
          </div>
        )}
        {!ready && (
          <p role={cartError ? "alert" : "status"} className="mt-3 text-sm text-muted-foreground">
            {cartError ?? "Loading your saved cart…"}
          </p>
        )}
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
