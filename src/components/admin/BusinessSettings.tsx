import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { apiCall } from "@/lib/store";
import { useBusiness } from "@/components/site/BusinessProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function BusinessSettings() {
  const business = useBusiness();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-4 md:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await apiCall("/admin/business", {
            method: "POST",
            body: JSON.stringify(
              Object.fromEntries(
                ["address", "whatsapp", "instagram", "tiktok"].map((k) => [k, f.get(k)]),
              ),
            ),
          });
          setSaved(true);
          await router.invalidate();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-medium">Business contacts</h2>
      <p className="text-sm text-muted-foreground">
        These details appear on your contact page, footer and business information. Registration
        numbers and the official logo retain their owner-approved source.
      </p>
      {(["address", "whatsapp", "instagram", "tiktok"] as const).map((k) => (
        <div key={k}>
          <Label htmlFor={`business-${k}`}>
            {
              {
                address: "Business address",
                whatsapp: "WhatsApp (+234…) ",
                instagram: "Instagram profile URL",
                tiktok: "TikTok profile URL",
              }[k]
            }
          </Label>
          <Input id={`business-${k}`} name={k} required defaultValue={business[k]} />
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Business contacts updated.</p>}
      <Button disabled={busy}>Save business contacts</Button>
    </form>
  );
}
