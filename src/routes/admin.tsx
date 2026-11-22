import { BannerPhoto } from "@/components/admin/BannerPhoto";
import { AdminImage } from "@/components/admin/AdminImage";
import { nairaToKobo } from "@/lib/images";
import { ProductManager, InventoryManager } from "@/components/admin/ProductManager";
import { OrderManager } from "@/components/admin/OrderManager";
import { PaymentReview } from "@/components/admin/PaymentReview";
import { BusinessSettings } from "@/components/admin/BusinessSettings";
import { AdminSecurity } from "@/components/admin/AdminSecurity";
import { PasswordSignIn, SetupPassword, SignOutButton } from "@/components/admin/PasswordAuth";
import { AdminNav } from "@/components/admin/AdminShell";
import { OverviewPanel } from "@/components/admin/OverviewPanel";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  required?: boolean;
  /** Browser-side format check, mirroring the server's validation, with a plain-language hint. */
  pattern?: string;
  hint?: string;
  placeholder?: string;
  /** Read-only when editing an existing record (it is the record's key). */
  lockOnEdit?: boolean;
};
// What one record is called in headings and confirmations.
const singular: Record<string, string> = {
  categories: "category",
  banners: "banner",
  zones: "delivery zone",
  content: "page text",
};
const forms: Record<string, Field[]> = {
  categories: [
    {
      name: "slug",
      label: "Category slug",
      required: true,
      pattern: "[a-z0-9\\-]+",
      placeholder: "e.g. toys-games",
      hint: "Lowercase letters, numbers and hyphens only. It is used in shop links and products refer to it, so it cannot be changed after saving.",
      lockOnEdit: true,
    },
    { name: "label", label: "Display label", required: true },
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
    { name: "title", label: "Title", required: true },
    {
      name: "href",
      label: "Shop or product link",
      required: true,
      pattern: "/(shop(\\?.*)?|product/[a-z0-9\\-]+)",
      placeholder: "e.g. /shop?category=clothing",
      hint: "Start with /shop or /product/, for example /shop?category=toys or /product/kids-gown.",
    },
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
  onCancel,
}: {
  kind: string;
  initial: Row;
  onSaved: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  // Blocks a second submit before the disabled button renders: a double tap on a new banner or
  // zone would otherwise create it twice.
  const sending = useRef(false);
  const editing = Object.keys(initial).length > 0;
  const name = singular[kind] ?? kind;
  return (
    <form
      key={`${kind}-${JSON.stringify(initial)}`}
      // min-w-0: a file input's intrinsic width otherwise widens the phone column past the card.
      className="grid gap-4 rounded-xl border bg-card p-4 md:p-6 sm:grid-cols-2 [&>*]:min-w-0"
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending.current) return;
        sending.current = true;
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
          sending.current = false;
          setBusy(false);
        }
      }}
    >
      <h3 className="text-base font-medium sm:col-span-2">
        {kind === "content" ? "Update page text" : `${editing ? "Edit" : "Add a"} ${name}`}
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
        const locked = Boolean(field.lockOnEdit && editing);
        const cls =
          "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
        return (
          <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
            <Label htmlFor={id}>{field.label}</Label>
            {field.hint && (
              <p id={`${id}-hint`} className="mb-1 text-xs text-muted-foreground">
                {locked ? "Cannot be changed after saving: products refer to it." : field.hint}
              </p>
            )}
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
                required={field.required}
                pattern={field.pattern}
                placeholder={field.placeholder}
                readOnly={locked}
                aria-describedby={field.hint ? `${id}-hint` : undefined}
                className={locked ? "bg-muted text-muted-foreground" : undefined}
                type={field.type ?? "text"}
                step={field.name === "feeKobo" ? 0.01 : field.type === "number" ? 1 : undefined}
                defaultValue={String(value)}
              />
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button disabled={busy || uploadBusy} className="w-full sm:w-auto">
          {busy || uploadBusy ? "Working…" : "Save changes"}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            Cancel editing
          </Button>
        )}
      </div>
    </form>
  );
}
function Admin() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState("overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [overview, setOverview] = useState<Row>({});
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [newProduct, setNewProduct] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [edit, setEdit] = useState<Row>({});
  // Bumped after a successful save so the form clears instead of still showing what was saved.
  const [saves, setSaves] = useState(0);
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
        } else if (tab === "overview") {
          setOverview(await apiCall("/admin/overview"));
          setOverviewLoaded(true);
        } else if (tab === "variants") {
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
            onSignInInstead={() => setSetupToken(null)}
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
            <p role="alert">Sign in with an authorized administrator account to continue.</p>
            <p className="text-sm text-muted-foreground">
              Sign in with your store administrator password to continue.
            </p>
            <PasswordSignIn
              onSignedIn={() => {
                window.dispatchEvent(new Event("afnan-auth"));
                void load();
              }}
            />
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
                <ProductManager startNew={newProduct} onStarted={() => setNewProduct(false)} />
              ) : tab === "inventory" ? (
                <InventoryManager />
              ) : tab === "orders" ? (
                <OrderManager />
              ) : tab === "business" ? (
                <BusinessSettings />
              ) : tab === "overview" ? (
                <OverviewPanel
                  overview={overview}
                  loaded={overviewLoaded}
                  onAction={(t, startNew) => {
                    setNewProduct(startNew);
                    setTab(t);
                    setEdit({});
                    setNotice("");
                    window.scrollTo({ top: 0 });
                  }}
                />
              ) : (
                <>
                  {tab === "payments" && <PaymentReview />}
                  {tab === "payments" && (
                    <h2 className="text-base font-medium">Online payments (Paystack, disabled)</h2>
                  )}
                  {forms[tab] && (
                    <Editor
                      key={`${tab}-${saves}`}
                      kind={tab}
                      initial={edit}
                      onSaved={() => {
                        const name = singular[tab] ?? tab;
                        setNotice(`${name[0]?.toUpperCase()}${name.slice(1)} saved.`);
                        setEdit({});
                        setSaves((n) => n + 1);
                        void load();
                      }}
                      onError={(message) => {
                        setNotice("");
                        setError(message);
                      }}
                      onCancel={() => setEdit({})}
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
                                {tab === "banners" &&
                                  typeof row["image_url"] === "string" &&
                                  row["image_url"] && (
                                    <AdminImage
                                      url={row["image_url"]}
                                      alt={`Banner photograph: ${String(row["title"] ?? "")}`}
                                      className="mb-1.5 h-16 w-28 rounded-lg object-cover"
                                    />
                                  )}
                                {tab === "banners" && (
                                  <span className="mb-1 block text-xs text-muted-foreground">
                                    {Number(row["active"]) ? "Published" : "Hidden"}
                                  </span>
                                )}
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
