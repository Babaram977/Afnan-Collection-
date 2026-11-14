import { useBusiness } from "@/components/site/BusinessProvider";
import { Link } from "@tanstack/react-router";
export function Wordmark({
  className = "",
  placement = "header",
}: {
  className?: string;
  placement?: "header" | "footer";
}) {
  const business = useBusiness();
  return (
    <Link
      to="/"
      className={`group inline-flex shrink-0 items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      aria-label={`${business.name} — home`}
    >
      {business.logoUrl ? (
        <img
          src={business.logoUrl}
          alt={business.name}
          className={`${placement === "footer" ? "w-44" : "w-28"} h-auto max-w-full rounded-md bg-white object-contain`}
          data-brand-logo="original"
          width={460}
          height={546}
          decoding="async"
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
