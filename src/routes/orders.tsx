import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { formatNaira } from "@/lib/catalog";
import { customerOrderStatus } from "@/lib/order-status";
import { apiCall } from "@/lib/store";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders on this device — Afnan Collection Online" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Orders,
});

interface Row {
  id: string;
  reference: string | null;
  status: string;
  total_kobo: number;
  created_at: number;
  paymentStatus?: string | null;
}
const when = (s: number) =>
  new Date(s * 1000).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium" });

/** Orders placed from this browser (guest-order cookie). No account or sign-in is involved. */
function Orders() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiCall<Row[]>("/orders")
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, []);
  return (
    <>
      <PageHeader
        title="Orders on this device"
        intro="Orders placed from this phone or computer. Tap one to see its status."
      />
      <div className="container-page py-8">
        {error ? (
          <p role="alert">{error}</p>
        ) : !rows ? (
          <p role="status">Loading…</p>
        ) : !rows.length ? (
          <EmptyState
            title="No orders on this device"
            action={
              <Link to="/shop" className="underline">
                Start shopping
              </Link>
            }
          >
            Orders you place from this browser will appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y rounded-2xl bg-card shadow-soft">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/order/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-secondary"
                >
                  <span className="font-semibold">{r.reference ?? r.id}</span>
                  <span className="text-sm text-muted-foreground">{when(r.created_at)}</span>
                  <span className="text-sm">{customerOrderStatus(r).label}</span>
                  <span className="font-semibold">{formatNaira(r.total_kobo)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
