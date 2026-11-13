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
  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group block rounded-2xl bg-card shadow-soft transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="aspect-square overflow-hidden rounded-t-2xl">
        <ProductImageOrPlaceholder
          src={product.images[0]?.url}
          alt={product.images[0]?.alt ?? product.name}
        />
      </div>
      <div className="p-4">
        <h3 className="font-sans text-sm font-semibold leading-snug">{product.name}</h3>
        {r && (
          <p className="mt-1 text-sm font-bold text-primary">
            {r.min === r.max ? formatNaira(r.min) : `${formatNaira(r.min)} – ${formatNaira(r.max)}`}
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
