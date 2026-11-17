import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Product/banner photo inside the admin dashboard. Always loads through the authorized
 * /api/admin/media/ route: the public /media/ route only serves photos of published products and
 * active banners, so drafts would otherwise appear broken to the administrator. A missing or
 * unreadable file shows a neutral placeholder instead of the browser's broken-image icon.
 */
export function AdminImage({
  url,
  alt = "",
  className = "",
}: {
  url: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        role="img"
        aria-label={alt ? `${alt} (photo unavailable)` : "Photo unavailable"}
        data-admin-image-missing
        className={`grid place-items-center bg-muted text-muted-foreground ${className}`}
      >
        <ImageOff className="size-5" aria-hidden />
      </span>
    );
  return (
    <img
      src={url.startsWith("/media/") ? url.replace("/media/", "/api/admin/media/") : url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
