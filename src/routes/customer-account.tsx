import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiCall } from "@/lib/store";
import { recentOrderIds } from "@/lib/order-status";
import { formatNaira } from "@/lib/catalog";

export const Route = createFileRoute("/customer-account")({
  head: () => ({ meta: [{ title: "Customer account — Afnan Collection", }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CustomerAccount,
});
type Order = {
  id:string;reference:string|null;status:string;total_kobo:number;
  delivery_kobo:number;created_at:number;bank_outcome:string|null;
  items:Array<{name:string;sku:string;qty:number;price_kobo:number}>;
};
function CustomerAccount() {
  const [available,setAvailable] = useState(false);
  const [signed,setSigned] = useState(false);
  const [email,setEmail] = useState("");
  const [code,setCode] = useState("");
  const [challenge,setChallenge] = useState("");
  const [orders,setOrders] = useState<Order[]>([]);
  const [recent,setRecent] = useState<string[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const loadHistory = useCallback(async () => {
    try {
      const result = await apiCall<{orders:Order[]}>("/customer-account/orders");
      setOrders(result.orders);
    } catch { setMessage("Order history is temporarily unavailable."); }
  }, []);
  useEffect(() => {
    setRecent(recentOrderIds());
    void apiCall<{enabled:boolean}>("/customer-account/config")
      .then(async ({enabled}) => {
        setAvailable(enabled);
        if (!enabled) return;
        try {
          const session = await apiCall<{email:string}>("/customer-account/session");
          setEmail(session.email);setSigned(true);void loadHistory();
        } catch { /* Guest or expired session: nothing is linked automatically. */ }
      }).catch(() => setMessage("Customer accounts are temporarily unavailable."));
  }, [loadHistory]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setMessage("");
    try {
      if (!challenge) {
        const result = await apiCall<{challenge:string}>("/customer-account/request",{
          method:"POST",body:JSON.stringify({email}),
        });
        setChallenge(result.challenge);
        setMessage("If available, a verification code has been sent. It expires in 10 minutes.");
      } else {
        await apiCall("/customer-account/verify",{
          method:"POST",body:JSON.stringify({email,challenge,code}),
        });
        setSigned(true);setCode("");
        setMessage("Email verified. Your customer account is ready.");
        await loadHistory();
      }
    } catch(e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader title="Your Afnan account" intro="Optional verified-email account and private order history. Guest shopping is always available." />
      <main className="container-page max-w-2xl space-y-6 py-8">
        {message && <p role="status" className="rounded-xl bg-card p-4">{message}</p>}
        {!available && <p>Customer account registration is not available yet. You can continue shopping as a guest.</p>}
        {available && !signed &&
          <form onSubmit={submit} className="space-y-4 rounded-2xl bg-card p-5">
            <label className="block space-y-1">Email address
              <Input type="email" value={email} required maxLength={254} readOnly={!!challenge}
                autoComplete="email" onChange={e=>setEmail(e.target.value)} />
            </label>
            {challenge && <label className="block space-y-1">Eight-digit verification code
              <Input inputMode="numeric" pattern="[0-9]{8}" required minLength={8} maxLength={8}
                autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} />
            </label>}
            <Button type="submit" disabled={busy}>{busy?"Please wait…":challenge?"Verify email":"Email me a sign-in code"}</Button>
            {challenge && <Button type="button" variant="outline" onClick={()=>{setChallenge("");setCode("");setMessage("You may request another code after 60 seconds.");}}>Try another email</Button>}
          </form>}
        {available && signed && <>
          <section className="space-y-3 rounded-2xl bg-card p-5">
            <h2 className="text-2xl font-semibold">Your purchase history</h2>
            <p className="text-sm text-muted-foreground">
              Only purchases explicitly saved to your verified account appear here. We never expose an order based solely on a matching email.
            </p>
            {orders.length===0 && <p>No orders have been linked yet.</p>}
            <ul className="space-y-3">
              {orders.map(o=><li key={o.id} className="rounded-xl border p-3">
                <p className="font-semibold">{o.reference??o.id}</p>
                <p>{new Date(o.created_at*1000).toLocaleDateString("en-NG",{timeZone:"Africa/Lagos"})}</p>
                <p>Status: {o.status} {o.bank_outcome==="paid"?"· Payment verified":""}</p>
                <p>{formatNaira(o.total_kobo)}</p>
                <ul className="text-sm text-muted-foreground">{o.items.map((item,i)=><li key={`${o.id}-${i}`}>{item.qty} × {item.name}</li>)}</ul>
              </li>)}
            </ul>
          </section>
          {recent.length>0 && <section className="space-y-3 rounded-2xl bg-card p-5">
            <h2 className="text-xl font-semibold">Save an order from this device</h2>
            <p className="text-sm">Optional. You can link a previous guest order only if this browser retains its private guest session and the checkout email matches your verified address.</p>
            {recent.filter(id=>!orders.some(o=>o.id===id)).map(id=><div key={id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="break-all text-xs">{id}</span>
              <Button disabled={busy} variant="outline" onClick={async()=>{
                setBusy(true);setMessage("");
                try {
                  await apiCall("/customer-account/orders/claim",{method:"POST",body:JSON.stringify({id})});
                  setRecent(prev=>prev.filter(x=>x!==id));await loadHistory();
                  setMessage("Order linked to your verified account.");
                } catch(e){setMessage((e as Error).message);}
                finally{setBusy(false);}
              }}>Save to my account</Button>
            </div>)}
          </section>}
          <Button variant="outline" onClick={async()=>{
            await apiCall("/customer-account/logout",{method:"POST",body:"{}"});
            setSigned(false);setOrders([]);setChallenge("");setMessage("Signed out.");
          }}>Sign out</Button>
        </>}
        <p className="text-sm text-muted-foreground">Customer accounts never grant Store Management access. <Link to="/shop" className="underline">Continue shopping</Link></p>
      </main>
    </>
  );
}
