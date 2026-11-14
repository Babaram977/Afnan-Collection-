import { useState } from "react";
import { optimizeProductPhoto } from "@/lib/images";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
export function BannerPhoto({
  initial,
  onBusy,
}: {
  initial: string;
  onBusy: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState(initial);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      <Label htmlFor="banner-photo">Banner photograph (optional)</Label>
      <input type="hidden" name="imageUrl" value={url} />
      <input
        id="banner-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) return;
          onBusy(true);
          setError("");
          try {
            const image = await optimizeProductPhoto(file);
            const response = await fetch("/api/admin/media", {
              method: "POST",
              body: image,
              headers: { "Content-Type": "image/webp" },
            });
            const result = (await response.json()) as { url: string; error?: string };
            if (!response.ok) throw new Error(result.error ?? "Upload failed");
            setUrl(result.url);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            onBusy(false);
          }
        }}
      />
      {url && (
        <>
          <img
            src={url.replace("/media/", "/api/admin/media/")}
            alt="Banner photograph preview"
            width={320}
            height={180}
            className="max-h-48 max-w-full rounded-xl object-contain"
          />
          <Button type="button" variant="outline" onClick={() => setUrl("")}>
            Remove banner photograph
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
