import { useEffect, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { apiCall } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSecurity({
  onVerified,
  settings = false,
}: {
  onVerified: () => void;
  settings?: boolean;
}) {
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [recovery, setRecovery] = useState("");
  useEffect(() => {
    void apiCall<{ state: string }>("/admin-security/status")
      .then((s) => setState(s.state))
      .catch(() => setState("unavailable"));
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication could not be completed");
    } finally {
      setBusy(false);
    }
  }
  async function register() {
    const { id, options } = await apiCall<{
      id: string;
      options: PublicKeyCredentialCreationOptionsJSON;
    }>("/admin-security/register/options", { method: "POST", body: "{}" });
    const response = await startRegistration({ optionsJSON: options });
    const result = await apiCall<{ recoveryCodes: string[] }>("/admin-security/register/verify", {
      method: "POST",
      body: JSON.stringify({ id, response }),
    });
    if (result.recoveryCodes.length) setCodes(result.recoveryCodes);
    else {
      setState("active");
      onVerified();
    }
  }
  async function authenticate() {
    const { id, options } = await apiCall<{
      id: string;
      options: PublicKeyCredentialRequestOptionsJSON;
    }>("/admin-security/authenticate/options", { method: "POST", body: "{}" });
    const response = await startAuthentication({ optionsJSON: options });
    await apiCall("/admin-security/authenticate/verify", {
      method: "POST",
      body: JSON.stringify({ id, response }),
    });
    onVerified();
  }
  if (state === "loading") return <p role="status">Checking administrator security…</p>;
  if (state === "unavailable" || state === "disabled")
    return <p>Staff access is required. An account administrator must approve enrollment.</p>;
  return (
    <section
      className="max-w-xl space-y-4 rounded-2xl bg-card p-6 shadow-soft"
      aria-label="Administrator security"
    >
      <h2 className="text-xl font-semibold">Administrator security</h2>
      <p>
        Email sign-in alone does not grant staff access. Use a passkey or security key with device
        verification.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {codes.length ? (
        <>
          <h3 className="font-semibold">Save your recovery codes now</h3>
          <p>
            These codes are shown once. Keep them offline in a secure place. Each recovery requires
            a fresh email sign-in and enrollment of a new authenticator.
          </p>
          <ul className="space-y-2">
            {codes.map((code) => (
              <li key={code} className="break-all font-mono text-sm">
                {code}
              </li>
            ))}
          </ul>
          <Button
            onClick={() => {
              setCodes([]);
              setState("active");
              onVerified();
            }}
          >
            I saved my recovery codes
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          {state === "active" && (
            <Button disabled={busy} onClick={() => void run(authenticate)}>
              {busy ? "Please wait…" : "Verify security key"}
            </Button>
          )}
          {(state !== "active" || settings) && (
            <Button disabled={busy} onClick={() => void run(register)}>
              {state === "active" ? "Add backup security key" : "Enroll passkey or security key"}
            </Button>
          )}
        </div>
      )}
      {state === "active" && !codes.length && (
        <details>
          <summary className="cursor-pointer">Lost your authenticator?</summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await apiCall("/admin-security/recover", {
                  method: "POST",
                  body: JSON.stringify({ code: recovery.trim() }),
                });
                setRecovery("");
                window.location.assign("/admin");
              });
            }}
          >
            <p>
              Sign in with a fresh email code first. Recovery revokes all sessions and existing
              keys. A new authenticator is required before administration resumes.
            </p>
            <Label htmlFor="admin-recovery">Single-use recovery code</Label>
            <Input
              id="admin-recovery"
              type="password"
              autoComplete="off"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              required
            />
            <Button disabled={busy}>Begin secure recovery</Button>
          </form>
        </details>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await apiCall("/admin-security/logout", { method: "POST", body: "{}" });
            window.location.assign("/admin");
          })
        }
      >
        Sign out of administration
      </Button>
    </section>
  );
}
