import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

/**
 * Customer upload of bank-transfer payment evidence. The server checks the file's contents,
 * size and order ownership; this component only gives early feedback.
 * Uploading never marks the order paid or extends the payment deadline.
 */
export function ReceiptUpload({
  orderId,
  onUploaded,
}: {
  orderId: string;
  onUploaded?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputId = `receipt-${orderId}`;
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        if (!file) return setError("Choose your receipt first.");
        if (file.size > MAX_BYTES) return setError("The receipt must be 5 MB or smaller.");
        setBusy(true);
        try {
          const response = await fetch(`/api/orders/${orderId}/receipts`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              ...(reference.trim() ? { "X-Transfer-Reference": reference.trim() } : {}),
            },
            body: file,
          });
          const data = (await response.json()) as { error?: string; duplicate?: boolean };
          if (!response.ok) throw new Error(data.error ?? "Upload failed");
          setMessage(
            data.duplicate
              ? "We already have this receipt. Our team will review it."
              : "Receipt received. Our team will check the payment and confirm your order.",
          );
          setFile(null);
          setReference("");
          onUploaded?.();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label htmlFor={inputId}>Upload your payment receipt</Label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="block w-full text-sm"
        onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
      />
      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or PDF, up to 5 MB.</p>
      <Label htmlFor={`${inputId}-reference`}>Transfer reference (optional)</Label>
      <input
        id={`${inputId}-reference`}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        maxLength={120}
        autoComplete="off"
        className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        aria-describedby={`${inputId}-reference-hint`}
      />
      <p id={`${inputId}-reference-hint`} className="text-xs text-muted-foreground">
        The reference or session ID shown in your bank app, if you have it. It helps us find your
        transfer; it does not confirm payment.
      </p>
      <Button type="submit" disabled={busy || !file}>
        {busy ? "Uploading…" : "Submit receipt"}
      </Button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
