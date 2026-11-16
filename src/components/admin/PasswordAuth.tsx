import { useState } from "react";
import { apiCall } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Administrator email + password sign-in (ADMIN_AUTH_MODE=password). There is no sign-up. */
export function PasswordSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-soft"
      data-admin-password-signin
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await apiCall("/auth/sign-in/email", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          setPassword("");
          onSignedIn();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Sign-in failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Administrator sign in</h2>
      <div>
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
    </form>
  );
}

/** One-time password setup from the operator's setup link (?setup=<token>). */
export function SetupPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-soft"
      data-admin-setup
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (password.length < 12) return setError("Use at least 12 characters.");
        if (password !== confirm) return setError("The two passwords do not match.");
        setBusy(true);
        try {
          await apiCall("/admin-setup", {
            method: "POST",
            body: JSON.stringify({ token, password }),
          });
          setPassword("");
          setConfirm("");
          window.history.replaceState(null, "", window.location.pathname);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Setup failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">Choose your administrator password</h2>
      <p className="text-sm text-muted-foreground">
        At least 12 characters. A password manager or a long phrase works best. This link works once
        and expires after 30 minutes.
      </p>
      <div>
        <Label htmlFor="setup-password">New password</Label>
        <Input
          id="setup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="setup-confirm">Confirm password</Label>
        <Input
          id="setup-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Saving…" : "Set password"}</Button>
    </form>
  );
}

export function SignOutButton({ onSignedOut }: { onSignedOut: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await apiCall("/auth/sign-out", { method: "POST", body: "{}" }).catch(() => undefined);
        window.dispatchEvent(new Event("afnan-auth"));
        onSignedOut();
      }}
    >
      Sign out
    </Button>
  );
}
