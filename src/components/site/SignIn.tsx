import { useState } from "react";
import { apiCall } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!sent) {
            await apiCall("/auth/email-otp/send-verification-otp", {
              method: "POST",
              body: JSON.stringify({ email, type: "sign-in" }),
            });
            setSent(true);
          } else {
            await apiCall("/auth/sign-in/email-otp", {
              method: "POST",
              body: JSON.stringify({ email, otp: code, name: name || email.split("@")[0] }),
            });
            onSignedIn();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Sign-in failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Sign in with email</h2>
      <p className="text-sm text-muted-foreground">
        We’ll send a single-use code. Use the same email to recover access to your account.
      </p>
      <div>
        <Label htmlFor="signin-name">Name</Label>
        <Input
          id="signin-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={sent}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {sent && (
        <div>
          <Label htmlFor="signin-code">Email code</Label>
          <Input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy}>
        {busy ? "Please wait…" : sent ? "Verify and sign in" : "Send sign-in code"}
      </Button>
      {sent && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSent(false);
            setCode("");
          }}
        >
          Use another email / resend
        </Button>
      )}
    </form>
  );
}
