import type { ReactNode } from "react";
import { Boxes, ClipboardList, Image as ImageIcon, PackagePlus, Receipt, Tags } from "lucide-react";
import { formatNaira } from "@/lib/catalog";
import { StatTile } from "./AdminShell";

type Row = Record<string, unknown>;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0));

const ACTIONS: { label: string; tab: string; newProduct?: boolean; icon: ReactNode }[] = [
  { label: "Add product", tab: "products", newProduct: true, icon: <PackagePlus /> },
  { label: "View inventory", tab: "inventory", icon: <Boxes /> },
  { label: "Manage orders", tab: "orders", icon: <ClipboardList /> },
  { label: "Review payments", tab: "payments", icon: <Receipt /> },
  { label: "Manage categories", tab: "categories", icon: <Tags /> },
  { label: "Manage banners", tab: "banners", icon: <ImageIcon /> },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
    </section>
  );
}

/** Store overview: business statistics from /api/admin/overview plus shortcuts to existing sections. */
export function OverviewPanel({
  overview,
  loaded,
  onAction,
}: {
  overview: Row;
  loaded: boolean;
  onAction: (tab: string, newProduct: boolean) => void;
}) {
  const catalogue = (overview["catalogue"] ?? {}) as Row;
  const inventory = (overview["inventory"] ?? {}) as Row;
  const sales = (overview["sales"] ?? {}) as Row;
  const low = (overview["lowStock"] ?? []) as Row[];
  const show = (value: unknown) => (loaded ? String(num(value)) : "…");
  return (
    <div className="space-y-5" aria-busy={!loaded}>
      <nav aria-label="Quick actions" className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onAction(a.tab, Boolean(a.newProduct))}
            className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl border bg-card px-2 py-2.5 text-center text-xs font-medium leading-tight transition hover:border-primary hover:text-primary [&_svg]:size-5 [&_svg]:text-primary"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </nav>
      <section aria-label="Overview" className="space-y-5" data-overview-stats>
        <Group title="Sales">
          <StatTile
            label="Awaiting fulfilment"
            value={show(overview["ordersAwaitingFulfilment"])}
            hint="Paid, not yet shipped"
          />
          <StatTile
            label="Awaiting review"
            value={show(overview["paymentsAwaitingReview"])}
            hint="Bank-transfer receipts"
          />
          <StatTile label="Paid orders" value={show(sales["orders"])} />
          <StatTile
            label="Paid sales"
            value={loaded ? formatNaira(num(sales["revenueKobo"])) : "…"}
          />
        </Group>
        <Group title="Catalogue">
          <StatTile
            label="Products"
            value={show(catalogue["total"])}
            hint={
              loaded && num(catalogue["archived"])
                ? `${num(catalogue["archived"])} archived`
                : undefined
            }
          />
          <StatTile label="Published" value={show(catalogue["published"])} />
          <StatTile label="Drafts" value={show(catalogue["drafts"])} />
        </Group>
        <Group title="Inventory">
          <StatTile
            label="Available units"
            value={show(inventory["available"])}
            hint="Ready to sell"
          />
          <StatTile
            label="Reserved units"
            value={show(inventory["reserved"])}
            hint={
              loaded
                ? `In ${num(inventory["reservedOrders"])} unpaid order${num(inventory["reservedOrders"]) === 1 ? "" : "s"}`
                : undefined
            }
          />
          <StatTile
            label="Low stock"
            value={show(inventory["lowStockVariants"])}
            hint="Options at or below alert"
          />
          <StatTile
            label="Out of stock"
            value={show(inventory["outOfStockVariants"])}
            hint="Options with 0 left"
          />
        </Group>
        <div className="rounded-xl border bg-card px-4 py-3">
          <h2 className="font-sans text-sm font-medium">Low and out of stock</h2>
          {!loaded ? (
            <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
          ) : low.length ? (
            <ul className="mt-2 divide-y text-sm">
              {low.map((v) => (
                <li key={String(v["id"])} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate">
                    {String(v["name"] ?? "")} · {String(v["sku"])}
                  </span>
                  <span
                    className={`tabular-nums ${num(v["stock"]) === 0 ? "text-destructive" : ""}`}
                  >
                    {num(v["stock"]) === 0 ? "Out of stock" : `${num(v["stock"])} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Nothing is running low.</p>
          )}
        </div>
      </section>
    </div>
  );
}
