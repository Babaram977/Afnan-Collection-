import { useBusiness } from "@/components/site/BusinessProvider";
import { Link } from "@tanstack/react-router";
export function Wordmark({ className = "" }: { className?: string }) {
  const business = useBusiness();
  return (
    <Link
      to="/"
      className={`group inline-flex items-baseline gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      aria-label={`${business.name} — home`}
    >
      {business.logoUrl ? (
        <img
          src={business.logoUrl}
          alt={business.name}
          className="h-14 w-auto max-w-40 object-contain"
          width={160}
          height={56}
        />
      ) : (
        <>
          <span className="font-display text-xl font-semibold text-foreground md:text-2xl">
            Afnan
          </span>
          <span className="font-display text-xl italic text-primary md:text-2xl">Collection</span>
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Online
          </span>
        </>
      )}
    </Link>
  );
}
