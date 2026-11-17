import { Link } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";
import { formatNaira, priceRange, type Product } from "@/lib/catalog";

export function ProductImageOrPlaceholder({
  src,
  alt,
  className = "",
}: {
  src?: string | undefined;
  alt: string;
  className?: string;
}) {
  if (src)
    return (
      <img src={src} alt={alt} loading="lazy" className={`size-full object-cover ${className}`} />
    );
  return (
    <div
      className={`placeholder-pattern grid size-full place-items-center text-muted-foreground ${className}`}
    >
      <span className="flex flex-col items-center gap-1 text-xs">
        <ImageOff className="size-6" aria-hidden />
        Photo coming soon
      </span>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const r = priceRange(product);
  // Stock across options: null means a variant does not track stock (treated as available).
  const tracked = product.variants.every((v) => v.stock != null);
  const total = product.variants.reduce((n, v) => n + (v.stock ?? 0), 0);
  const soldOut = product.variants.length > 0 && tracked && total === 0;
  const few = tracked && total > 0 && total <= 3;
  const sale = product.variants.find((v) => v.salePriceKobo != null && v.regularPriceKobo);
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block rounded-2xl bg-card shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden rounded-t-2xl">
        <ProductImageOrPlaceholder
          src={product.images[0]?.url}
          alt={product.images[0]?.alt ?? product.name}
          className={soldOut ? "opacity-60" : ""}
        />
        {(soldOut || few || sale) && (
          <span
            data-card-badge
            className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-soft ${soldOut ? "bg-foreground text-background" : few ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground"}`}
          >
            {soldOut ? "Sold out" : few ? `Only ${total} left` : "Sale"}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="break-words font-sans text-sm font-semibold leading-snug">{product.name}</h3>
        {r && (
          <p className="mt-1 text-sm font-bold text-primary">
            {r.min === r.max ? formatNaira(r.min) : `${formatNaira(r.min)} – ${formatNaira(r.max)}`}
            {sale && r.min === r.max && (
              <del className="ml-1.5 text-xs font-normal text-muted-foreground">
                {formatNaira(sale.regularPriceKobo!)}
              </del>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
