import { BannerPhoto } from "@/components/admin/BannerPhoto";
import { nairaToKobo } from "@/lib/images";
import { ProductManager, InventoryManager } from "@/components/admin/ProductManager";
import { OrderManager } from "@/components/admin/OrderManager";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { AdminSecurity } from "@/components/admin/AdminSecurity";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
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
      className="grid gap-4 rounded-2xl bg-card p-6 shadow-soft sm:grid-cols-2"
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
      <h3 className="text-xl font-semibold sm:col-span-2">
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
      <PageHeader
        title="Store management"
        intro="Manage catalog, stock and fulfilment with your staff account."
      />
      <div className="container-page space-y-6 py-8">
        {error && (
          <p role="alert" className="rounded-xl bg-warning p-4 text-warning-foreground">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {loading && !me && <p role="status">Checking access…</p>}
        {!loading && !me?.userId ? (
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
              <details>
                <summary className="cursor-pointer">Security and sign out</summary>
                <AdminSecurity settings onVerified={() => void load()} />
              </details>
              <nav aria-label="Administration" className="flex flex-wrap gap-2">
                {tabs
                  .filter((t) => me.role === "admin" || ["overview", "orders"].includes(t))
                  .map((t) => (
                    <Button
                      key={t}
                      variant={t === tab ? "default" : "outline"}
                      onClick={() => {
                        setTab(t);
                        setEdit({});
                        setNotice("");
                      }}
                    >
                      {t[0]?.toUpperCase()}
                      {t.slice(1)}
                    </Button>
                  ))}
              </nav>
              {tab === "products" ? (
                <ProductManager />
              ) : tab === "inventory" ? (
                <InventoryManager />
              ) : tab === "orders" ? (
                <OrderManager />
              ) : tab === "business" ? (
                <BusinessSettings />
              ) : tab === "overview" ? (
                <section className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-card p-6 shadow-soft">
                    <h2 className="text-lg">Products</h2>
                    <p className="text-3xl">{String(overview["products"] ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-card p-6 shadow-soft">
                    <h2 className="text-lg">Paid sales</h2>
                    <p className="text-3xl">
                      {formatNaira(
                        Number((overview["sales"] as Row | undefined)?.["revenueKobo"] ?? 0),
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-card p-6 shadow-soft">
                    <h2 className="text-lg">Low stock</h2>
                    {((overview["lowStock"] ?? []) as Row[]).map((v) => (
                      <p key={String(v["id"])}>
                        {String(v["sku"])}: {String(v["stock"])}
                      </p>
                    ))}
                  </div>
                </section>
              ) : (
                <>
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
                  {tab === "products" && (
                    <form
                      className="rounded-2xl bg-card p-6"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const image = f.get("image");
                        if (!(image instanceof File)) return;
                        try {
                          const response = await fetch("/api/admin/media", {
                            method: "POST",
                            body: image,
                            headers: { "Content-Type": image.type },
                          });
                          const data = (await response.json()) as { error?: string; url?: string };
                          if (!response.ok) throw new Error(data.error);
                          setNotice(`Image uploaded. Use this URL: ${data.url}`);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Label htmlFor="product-upload">
                        Product image (PNG, JPEG, WebP; up to 5 MB)
                      </Label>
                      <input
                        className="my-3 block w-full"
                        id="product-upload"
                        name="image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        required
                      />
                      <Button>Upload image</Button>
                    </form>
                  )}
                  <section
                    className="overflow-x-auto rounded-2xl bg-card p-4 shadow-soft"
                    aria-label={`${tab} records`}
                  >
                    <h2 className="mb-4 text-xl font-semibold capitalize">{tab}</h2>
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
