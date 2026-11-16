import { BannerPhoto } from "@/components/admin/BannerPhoto";
import { nairaToKobo } from "@/lib/images";
import { ProductManager, InventoryManager } from "@/components/admin/ProductManager";
import { OrderManager } from "@/components/admin/OrderManager";
import { PaymentReview } from "@/components/admin/PaymentReview";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { AdminSecurity } from "@/components/admin/AdminSecurity";
import { PasswordSignIn, SetupPassword, SignOutButton } from "@/components/admin/PasswordAuth";
import { AdminNav, StatTile } from "@/components/admin/AdminShell";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SignIn } from "@/components/site/SignIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiCall, type Me } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Afnan Collection Online" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
});
type Row = Record<string, unknown>;
type Field = {
  name: string;
  label: string;
  type?: "number" | "checkbox" | "textarea" | "select";
  options?: string[];
  value?: string;
};
const forms: Record<string, Field[]> = {
  categories: [
    { name: "slug", label: "Category slug" },
    { name: "label", label: "Display label" },
  ],
  zones: [
    { name: "id", label: "Zone ID (blank for new)" },
    { name: "name", label: "Area name" },
    { name: "state", label: "State (e.g. Kano)" },
    { name: "feeKobo", label: "Delivery charge (₦)", type: "number" },
    { name: "active", label: "Available for checkout", type: "checkbox" },
  ],
  banners: [
    { name: "id", label: "Banner ID (blank for new)" },
    { name: "title", label: "Title" },
    { name: "href", label: "Shop or product link" },
    { name: "imageUrl", label: "Uploaded image URL (optional)" },
    { name: "active", label: "Published", type: "checkbox" },
  ],
  content: [
    {
      name: "key",
      label: "Page",
      type: "select",
      options: ["about", "contact", "privacy", "returns", "delivery"],
    },
    { name: "value", label: "Approved plain text", type: "textarea" },
  ],
};
function Editor({
  kind,
  initial,
  onSaved,
  onError,
}: {
  kind: string;
  initial: Row;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  return (
    <form
      key={`${kind}-${JSON.stringify(initial)}`}
      className="grid gap-4 rounded-xl border bg-card p-4 md:p-6 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const data: Row = {};
          for (const field of forms[kind] ?? []) {
            data[field.name] =
              field.type === "checkbox"
                ? f.has(field.name)
                : field.type === "number"
                  ? field.name === "feeKobo"
                    ? nairaToKobo(String(f.get(field.name)))
                    : Number(f.get(field.name))
                  : String(f.get(field.name) ?? "");
          }
          if (data["id"] === "") delete data["id"];
          await apiCall(`/admin/${kind}`, { method: "POST", body: JSON.stringify(data) });
          onSaved();
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="text-base font-medium sm:col-span-2">
        {initial["id"] ? "Edit" : "Add / update"} {kind}
      </h3>
      {(forms[kind] ?? []).map((field) => {
        let value = initial[field.name] ?? field.value ?? "";
        if (field.name === "feeKobo" && value !== "") value = String(Number(value) / 100);
        if (field.name === "imageUrl")
          return <BannerPhoto key="imageUrl" initial={String(value)} onBusy={setUploadBusy} />;
        if (field.name === "id")
          return <input key="id" type="hidden" name="id" value={String(value)} />;
        if (field.name === "ageGroups" && Array.isArray(value)) value = value.join(", ");
        if (field.name === "images" && Array.isArray(value))
          value = value.map((i) => `${i.url} | ${i.alt}`).join("\n");
        const id = `edit-${kind}-${field.name}`;
        const cls =
          "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
        return (
          <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <Label htmlFor={id}>{field.label}</Label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                name={field.name}
                className={cls}
                rows={4}
                defaultValue={String(value)}
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                name={field.name}
                className={cls}
                defaultValue={String(value || field.options?.[0])}
              >
                {field.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <input
                id={id}
                name={field.name}
                type="checkbox"
                className="ml-3 size-5 align-middle"
                defaultChecked={Boolean(value)}
              />
            ) : (
              <Input
                id={id}
                name={field.name}
                type={field.type ?? "text"}
                step={field.name === "feeKobo" ? 0.01 : field.type === "number" ? 1 : undefined}
                defaultValue={String(value)}
              />
            )}
          </div>
        );
      })}
      <Button disabled={busy || uploadBusy}>
        {busy || uploadBusy ? "Working…" : "Save changes"}
      </Button>
    </form>
  );
}
function Admin() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [overview, setOverview] = useState<Row>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState<Row>({});
  const [loading, setLoading] = useState(true);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("setup");
    if (token && /^[a-f0-9]{64}$/.test(token)) setSetupToken(token);
  }, []);
  const passwordMode = me?.adminAuth === "password";
  const tabs = [
    "overview",
    "products",
    "inventory",
    "orders",
    "customers",
    "categories",
    "banners",
    "zones",
    "payments",
    "content",
    "audit",
    "business",
  ];
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const m = await apiCall<Me>("/me");
      setMe(m);
      if (m.role) {
        if (["products", "inventory", "orders", "business"].includes(tab)) {
          setRows([]);
        } else if (tab === "overview") setOverview(await apiCall("/admin/overview"));
        else if (tab === "variants") {
          const products = await apiCall<(Row & { variants: Row[] })[]>("/admin/products");
          setRows(products.flatMap((p) => p.variants.map((v) => ({ ...v, productId: p["id"] }))));
        } else setRows(await apiCall(`/admin/${tab}`));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);
  useEffect(() => {
    void load();
  }, [load]);
  async function post(path: string, method = "POST", data: Row = {}) {
    setError("");
    try {
      await apiCall(path, { method, body: JSON.stringify(data) });
      setNotice("Saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div
        data-admin-page
        className="container-page space-y-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4 md:space-y-6 md:pt-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-medium md:text-2xl">Store management</h1>
            {!me?.role && (
              <p className="text-sm text-muted-foreground">
                Manage catalogue, stock and fulfilment with your staff account.
              </p>
            )}
          </div>
          {me?.role && passwordMode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="max-w-[12rem] truncate" title={me.email ?? ""}>
                {me.email}
              </span>
              <SignOutButton compact onSignedOut={() => void load()} />
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-warning p-4 text-warning-foreground">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {loading && !me && <p role="status">Checking access…</p>}
        {passwordMode && setupToken && !me?.userId ? (
          <SetupPassword
            token={setupToken}
            onDone={() => {
              setSetupToken(null);
              setNotice("Password saved. Sign in with your email and new password.");
            }}
          />
        ) : passwordMode && !loading && !me?.userId ? (
          <PasswordSignIn
            onSignedIn={() => {
              setNotice("");
              window.dispatchEvent(new Event("afnan-auth"));
              void load();
            }}
          />
        ) : passwordMode && me?.userId && !me.role ? (
          <div className="max-w-md space-y-4 rounded-xl border bg-card p-4 md:p-6">
            <p role="alert">This account does not have administrator access.</p>
            <SignOutButton onSignedOut={() => void load()} />
          </div>
        ) : !loading && !me?.userId ? (
          <SignIn
            onSignedIn={() => {
              window.dispatchEvent(new Event("afnan-auth"));
              void load();
            }}
          />
        ) : me?.userId && !me.role ? (
          <AdminSecurity onVerified={() => void load()} />
        ) : (
          me?.role && (
            <>
              {!passwordMode && (
                <details>
                  <summary className="cursor-pointer">Security and sign out</summary>
                  <AdminSecurity settings onVerified={() => void load()} />
                </details>
              )}
              <AdminNav
                tabs={tabs.filter((t) => me.role === "admin" || ["overview", "orders"].includes(t))}
                current={tab}
                onSelect={(t) => {
                  setTab(t);
                  setEdit({});
                  setNotice("");
                  window.scrollTo({ top: 0 });
                }}
              />
              {tab === "products" ? (
                <ProductManager />
              ) : tab === "inventory" ? (
                <InventoryManager />
              ) : tab === "orders" ? (
                <OrderManager />
              ) : tab === "business" ? (
                <BusinessSettings />
              ) : tab === "overview" ? (
                <section aria-label="Overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatTile label="Products" value={String(overview["products"] ?? 0)} />
                    <StatTile
                      label="Awaiting review"
                      value={String(overview["paymentsAwaitingReview"] ?? 0)}
                      hint="Bank-transfer receipts"
                    />
                    <StatTile
                      label="Paid orders"
                      value={String((overview["sales"] as Row | undefined)?.["orders"] ?? 0)}
                    />
                    <StatTile
                      label="Paid sales"
                      value={formatNaira(
                        Number((overview["sales"] as Row | undefined)?.["revenueKobo"] ?? 0),
                      )}
                    />
                  </div>
                  <div className="rounded-xl border bg-card px-4 py-3">
                    <h2 className="font-sans text-sm font-medium">Low stock</h2>
                    {((overview["lowStock"] ?? []) as Row[]).length ? (
                      <ul className="mt-2 divide-y text-sm">
                        {((overview["lowStock"] ?? []) as Row[]).map((v) => (
                          <li key={String(v["id"])} className="flex justify-between gap-3 py-1.5">
                            <span className="min-w-0 truncate">
                              {String(v["name"] ?? "")} · {String(v["sku"])}
                            </span>
                            <span className="tabular-nums">{String(v["stock"])} left</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Nothing is running low.</p>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  {tab === "payments" && <PaymentReview />}
                  {tab === "payments" && (
                    <h2 className="text-base font-medium">Online payments (Paystack, disabled)</h2>
                  )}
                  {forms[tab] && (
                    <Editor
                      kind={tab}
                      initial={edit}
                      onSaved={() => {
                        setNotice("Saved.");
                        setEdit({});
                        void load();
                      }}
                      onError={setError}
                    />
                  )}
                  <section
                    className="overflow-x-auto rounded-xl border bg-card p-4"
                    aria-label={`${tab} records`}
                  >
                    <h2 className="mb-3 text-base font-medium capitalize">{tab}</h2>
                    {!rows.length ? (
                      <p>No records yet.</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th className="p-2">Record</th>
                            <th className="p-2">Details</th>
                            <th className="p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr
                              key={String(row["id"] ?? row["reference"] ?? i)}
                              className="border-t"
                            >
                              <td className="max-w-48 break-words p-2">
                                {String(
                                  row["name"] ??
                                    row["sku"] ??
                                    row["title"] ??
                                    row["label"] ??
                                    row["key"] ??
                                    row["id"] ??
                                    row["reference"] ??
                                    i,
                                )}
                              </td>
                              <td className="max-w-xl p-2">
                                <details>
                                  <summary className="cursor-pointer text-primary">
                                    View details
                                  </summary>
                                  <dl className="mt-2 space-y-2">
                                    {Object.entries(row).map(([k, v]) => (
                                      <div key={k}>
                                        <dt className="font-semibold">{k}</dt>
                                        <dd className="break-all whitespace-pre-wrap">
                                          {typeof v === "object"
                                            ? JSON.stringify(v, null, 2)
                                            : String(v)}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </details>
                              </td>
                              <td className="space-y-2 p-2">
                                {forms[tab] && tab !== "inventory" && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      const snake: Record<string, string> = {
                                        fee_kobo: "feeKobo",
                                        image_url: "imageUrl",
                                      };
                                      setEdit(
                                        Object.fromEntries(
                                          Object.entries(row).map(([k, v]) => [snake[k] ?? k, v]),
                                        ),
                                      );
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                {tab === "orders" &&
                                  ["pending", "paid", "processing", "shipped"].includes(
                                    String(row["status"]),
                                  ) && (
                                    <Button
                                      onClick={() =>
                                        void post(`/admin/orders/${row["id"]}`, "PATCH", {
                                          status: (
                                            {
                                              pending: "cancelled",
                                              paid: "processing",
                                              processing: "shipped",
                                              shipped: "delivered",
                                            } as Row
                                          )[String(row["status"])],
                                        })
                                      }
                                    >
                                      {
                                        (
                                          {
                                            pending: "Cancel reservation",
                                            paid: "Process",
                                            processing: "Mark shipped",
                                            shipped: "Mark delivered",
                                          } as Row
                                        )[String(row["status"])] as string
                                      }
                                    </Button>
                                  )}
                                {tab === "payments" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        void post(`/admin/payments/${row["reference"]}/reconcile`)
                                      }
                                    >
                                      Verify transaction
                                    </Button>
                                    {["paid", "review", "refund_pending"].includes(
                                      String(row["status"]),
                                    ) && (
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              "Confirm a full test refund / check refund status? Returned stock must be adjusted separately.",
                                            )
                                          )
                                            void post(
                                              `/admin/payments/${row["reference"]}/refund`,
                                              "POST",
                                              { confirm: true },
                                            );
                                        }}
                                      >
                                        {["paid", "review"].includes(String(row["status"]))
                                          ? "Refund payment"
                                          : "Check refund status"}
                                      </Button>
                                    )}
                                  </>
                                )}
                                {tab === "customers" && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      void post(`/admin/customers/${row["id"]}/revoke`)
                                    }
                                  >
                                    Revoke sessions
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}
