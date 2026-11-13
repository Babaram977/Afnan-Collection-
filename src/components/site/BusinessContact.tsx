import { useBusiness } from "@/components/site/BusinessProvider";
export function BusinessContact({ compact = false }: { compact?: boolean }) {
  const business = useBusiness();
  return (
    <div className={compact ? "space-y-3 text-sm" : "space-y-5"}>
      <address className="not-italic leading-relaxed">{business.address}</address>
      <p>
        <a
          href={business.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
          aria-label={`WhatsApp ${business.whatsappDisplay} (opens in a new tab)`}
        >
          WhatsApp: {business.whatsappDisplay}
        </a>
      </p>
      <nav
        aria-label={compact ? "Footer social links" : "Contact social links"}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        <a
          href={business.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          aria-label="Instagram (opens in a new tab)"
        >
          Instagram
        </a>
        <a
          href={business.tiktok}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          aria-label="TikTok (opens in a new tab)"
        >
          TikTok
        </a>
      </nav>
    </div>
  );
}
