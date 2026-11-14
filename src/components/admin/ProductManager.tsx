import { useCallback, useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
import type { Product, ProductVariant, AgeGroup, CategorySlug } from "@/lib/catalog";
import { AGE_GROUPS, formatNaira } from "@/lib/catalog";
import { nairaToKobo, optimizeProductPhoto } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type Variant = ProductVariant & { lowStock: number };
type Managed = Omit<Product, "variants"> & {
  status: "draft" | "active" | "archived";
  variants: Variant[];
};
const field = "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2";
function VariantEditor({
  productId,
  variant,
  onSaved,
  onError,
}: {
  productId: string;
  variant: Variant | null;
  onSaved: () => void;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      key={variant?.id ?? "new"}
      className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget;
        const f = new FormData(form);
        try {
          const sale = String(f.get("sale") ?? "").trim();
          await apiCall("/admin/variants", {
            method: "POST",
            body: JSON.stringify({
              ...(variant ? { id: variant.id } : {}),
              productId,
              sku: f.get("sku"),
              size: f.get("size"),
              color: f.get("color"),
              priceKobo: nairaToKobo(String(f.get("price"))),
              salePriceKobo: sale ? nairaToKobo(sale) : null,
              openingStock: variant ? 0 : Number(f.get("opening")),
              lowStock: Number(f.get("lowStock")),
            }),
          });
          form.reset();
          onSaved();
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h4 className="text-lg font-semibold sm:col-span-2">
        {variant ? "Edit size / colour" : "Add a size / colour"}
      </h4>
      {[
        [
          "sku",
          "Unique SKU",
          variant?.sku ?? `AC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        ],
        ["size", "Size", variant?.size ?? ""],
        ["color", "Colour", variant?.color ?? ""],
        [
          "price",
          "Regular price (₦)",
          variant ? String((variant.regularPriceKobo ?? variant.priceKobo) / 100) : "",
        ],
        [
          "sale",
          "Promotional price (₦, optional)",
          variant?.salePriceKobo ? String(variant.salePriceKobo / 100) : "",
        ],
        ["lowStock", "Alert when stock is at or below", String(variant?.lowStock ?? 3)],
        ...(!variant ? [["opening", "Opening stock quantity", "0"]] : []),
      ].map(([name, label, value]) => (
        <div key={name}>
          <Label htmlFor={`variant-${name}`}>{label}</Label>
          <Input
            id={`variant-${name}`}
            name={name}
            required={["sku", "price", "lowStock", "opening"].includes(name ?? "")}
            inputMode={["price", "sale"].includes(name ?? "") ? "decimal" : undefined}
            type={["lowStock", "opening"].includes(name ?? "") ? "number" : "text"}
            min={["lowStock", "opening"].includes(name ?? "") ? 0 : undefined}
            defaultValue={value}
          />
        </div>
      ))}
      <Button disabled={busy}>{busy ? "Saving…" : "Save option"}</Button>
    </form>
  );
}
function ProductEditor({
  initial,
  categories,
  onSaved,
  onClose,
}: {
  initial: Managed | null;
  categories: { slug: CategorySlug; label: string }[];
  onSaved: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [id, setId] = useState(initial?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [images, setImages] = useState(initial?.images ?? []);
  const [ages, setAges] = useState<AgeGroup[]>(initial?.ageGroups ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [variants, setVariants] = useState(initial?.variants ?? []);
  async function reload() {
    const rows = await apiCall<Managed[]>("/admin/products");
    setVariants(rows.find((p) => p.id === id)?.variants ?? []);
    setSelectedVariant(null);
    await onSaved(id);
  }
  return (
    <section className="space-y-5 rounded-2xl bg-card p-5 shadow-soft md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{id ? "Edit product" : "New product"}</h2>
        <Button variant="outline" onClick={onClose}>
          Back to products
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const result = await apiCall<{ id: string }>("/admin/products", {
              method: "POST",
              body: JSON.stringify({
                ...(id ? { id } : {}),
                name: f.get("name"),
                slug: f.get("slug"),
                category: f.get("category"),
                description: f.get("description"),
                status: f.get("status"),
                ageGroups: ages,
                images,
                featured: f.has("featured"),
                seasonal: f.has("seasonal"),
                ageGuidance: f.get("ageGuidance"),
                safetyNotes: f.get("safetyNotes"),
              }),
            });
            setId(result.id);
            await onSaved(result.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <Label htmlFor="product-name">Product name</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              setName(value);
              if (!slugEdited)
                setSlug(
                  value
                    .toLowerCase()
                    .normalize("NFKD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
            name="name"
            required
          />
        </div>
        <div>
          <Label htmlFor="product-slug">Product link name</Label>
          <Input
            id="product-slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="e.g. cotton-baby-romper"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
        </div>
        <div>
          <Label htmlFor="product-category">Category</Label>
          <select
            id="product-category"
            name="category"
            className={field}
            required
            defaultValue={initial?.category ?? ""}
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="product-status">Visibility</Label>
          <select
            id="product-status"
            name="status"
            className={field}
            defaultValue={initial?.status ?? "draft"}
          >
            <option value="draft">Draft — hidden from shoppers</option>
            <option value="active">Published — available in the shop</option>
            <option value="archived">Archived — hidden, records retained</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="product-description">Description</Label>
          <textarea
            id="product-description"
            name="description"
            className={field}
            rows={4}
            defaultValue={initial?.description}
          />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 font-semibold">Age groups</legend>
          <div className="flex flex-wrap gap-4">
            {AGE_GROUPS.map((a) => (
              <label key={a.slug} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={ages.includes(a.slug)}
                  onChange={(e) =>
                    setAges((previous) =>
                      e.target.checked
                        ? [...previous, a.slug]
                        : previous.filter((x) => x !== a.slug),
                    )
                  }
                />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-5 sm:col-span-2">
          {[
            ["featured", "Featured on homepage"],
            ["seasonal", "Seasonal collection"],
          ].map(([name, label]) => (
            <label key={name} className="flex min-h-11 items-center gap-2">
              <input
                name={name}
                type="checkbox"
                defaultChecked={name === "featured" ? initial?.featured : initial?.seasonal}
              />
              {label}
            </label>
          ))}
        </div>
        <div>
          <Label htmlFor="product-age-guidance">Factual age guidance (optional)</Label>
          <textarea
            className={field}
            id="product-age-guidance"
            name="ageGuidance"
            defaultValue={initial?.ageGuidance}
          />
        </div>
        <div>
          <Label htmlFor="product-safety">Factual safety information (optional)</Label>
          <textarea
            className={field}
            id="product-safety"
            name="safetyNotes"
            defaultValue={initial?.safetyNotes}
          />
        </div>
        <section className="space-y-4 sm:col-span-2" aria-labelledby="product-photos">
          <h3 id="product-photos" className="text-xl font-semibold">
            Photographs
          </h3>
          <p className="text-sm text-muted-foreground">
            Add up to 12 JPG, PNG or WebP files. Photos are resized to at most 1600 pixels and
            optimized for mobile. The first photo is the main image.
          </p>
          <Label htmlFor="product-photos-upload">Upload product photographs</Label>
          <input
            id="product-photos-upload"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            className="block w-full"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.currentTarget.value = "";
              if (images.length + files.length > 12) {
                setError("Use no more than 12 photographs.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const uploaded: Product["images"] = [];
                for (const file of files) {
                  const blob = await optimizeProductPhoto(file);
                  const response = await fetch("/api/admin/media", {
                    method: "POST",
                    body: blob,
                    headers: { "Content-Type": "image/webp" },
                  });
                  const data = (await response.json()) as { url: string; error?: string };
                  if (!response.ok) throw new Error(data.error ?? "Upload failed");
                  uploaded.push({ url: data.url, alt: initial?.name ?? "Product photograph" });
                }
                setImages((previous) => [...previous, ...uploaded]);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image, index) => (
              <li key={image.url} className="space-y-3 rounded-xl border p-3">
                <img
                  src={image.url.replace("/media/", "/api/admin/media/")}
                  width={160}
                  height={160}
                  alt={image.alt}
                  className="aspect-square w-full rounded-lg object-contain"
                />
                <Label htmlFor={`image-alt-${index}`}>Photo description</Label>
                <Input
                  id={`image-alt-${index}`}
                  required
                  value={image.alt}
                  onChange={(e) =>
                    setImages((previous) =>
                      previous.map((im, i) => (i === index ? { ...im, alt: e.target.value } : im)),
                    )
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() =>
                      setImages((previous) => [
                        previous[index]!,
                        ...previous.filter((_, i) => i !== index),
                      ])
                    }
                  >
                    {index === 0 ? "Main image" : "Make main image"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImages((previous) => previous.filter((_, i) => i !== index))}
                  >
                    Remove from product
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <Button disabled={busy}>{busy ? "Working…" : "Save product"}</Button>
      </form>
      {id ? (
        <section className="space-y-4 border-t pt-5">
          <h3 className="text-xl font-semibold">Prices, sizes, colours and stock</h3>
          <ul className="space-y-3">
            {variants.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary p-3"
              >
                <span>
                  {v.sku} · {[v.size, v.color].filter(Boolean).join(" / ")} ·{" "}
                  {formatNaira(v.priceKobo)} · {v.stock ?? 0} available
                </span>
                <Button variant="outline" onClick={() => setSelectedVariant(v)}>
                  Edit option
                </Button>
              </li>
            ))}
          </ul>
          <VariantEditor
            key={selectedVariant?.id ?? "new"}
            productId={id}
            variant={selectedVariant}
            onSaved={() => void reload()}
            onError={setError}
          />
          <Button variant="outline" onClick={() => setSelectedVariant(null)}>
            Add another option
          </Button>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Save the product first, then add its prices, sizes, colours and opening stock below.
        </p>
      )}
    </section>
  );
}
export function ProductManager() {
  const [products, setProducts] = useState<Managed[]>([]);
  const [categories, setCategories] = useState<{ slug: CategorySlug; label: string }[]>([]);
  const [selected, setSelected] = useState<Managed | null | undefined>(undefined);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        apiCall<Managed[]>("/admin/products"),
        apiCall<typeof categories>("/categories"),
      ]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-5">
      {error && <p role="alert">{error}</p>}
      {selected !== undefined ? (
        <ProductEditor
          key={selected?.id ?? "new"}
          initial={selected}
          categories={categories}
          onClose={() => {
            setSelected(undefined);
            void load();
          }}
          onSaved={async () => {
            await load();
          }}
        />
      ) : (
        <>
          <Button onClick={() => setSelected(null)}>Add product</Button>
          <ul className="grid gap-4 md:grid-cols-2">
            {products.map((p) => (
              <li key={p.id} className="space-y-3 rounded-2xl bg-card p-5 shadow-soft">
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p>
                  {p.status} · {p.variants.length} options ·{" "}
                  {p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)} available
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setSelected(p)}>Edit product</Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          `Delete ${p.name}? It will disappear from the catalog. Historical orders are kept.`,
                        )
                      )
                        return;
                      try {
                        await apiCall(`/admin/products/${p.id}`, { method: "DELETE" });
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete product
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {!products.length && <p>No products yet. Add your first genuine product above.</p>}
        </>
      )}
    </div>
  );
}
export function InventoryManager() {
  const [products, setProducts] = useState<Managed[]>([]);
  const [error, setError] = useState("");
  const [movements, setMovements] = useState<
    { id: number; variant_id: string; delta: number; reason: string; created_at: number }[]
  >([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        apiCall<Managed[]>("/admin/products"),
        apiCall<typeof movements>("/admin/inventory"),
      ]);
      setProducts(p);
      setMovements(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="space-y-5 rounded-2xl bg-card p-6 shadow-soft">
      <h2 className="text-2xl font-semibold">Adjust stock</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await apiCall("/admin/inventory", {
              method: "POST",
              body: JSON.stringify({
                variantId: f.get("variant"),
                delta: Number(f.get("quantity")) * (f.get("operation") === "remove" ? -1 : 1),
                reason: f.get("reason"),
              }),
            });
            setNotice("Stock updated and movement recorded.");
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="sm:col-span-2">
          <Label htmlFor="stock-product">Product and option</Label>
          <select className={field} id="stock-product" name="variant" required defaultValue="">
            <option value="">Select a product option</option>
            {products.flatMap((p) =>
              p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {p.name} — {v.sku} — {v.stock ?? 0} available
                </option>
              )),
            )}
          </select>
        </div>
        <div>
          <Label htmlFor="stock-operation">Operation</Label>
          <select className={field} id="stock-operation" name="operation">
            <option value="add">Add stock</option>
            <option value="remove">Remove stock</option>
          </select>
        </div>
        <div>
          <Label htmlFor="stock-quantity">Quantity</Label>
          <Input id="stock-quantity" name="quantity" type="number" min={1} max={100000} required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="stock-reason">Reason</Label>
          <Input
            id="stock-reason"
            name="reason"
            minLength={3}
            maxLength={200}
            required
            placeholder="e.g. goods received, damaged item, count correction"
          />
        </div>
        <Button disabled={busy}>Record stock movement</Button>
      </form>
      <section className="border-t pt-5" aria-labelledby="stock-ledger">
        <h3 id="stock-ledger" className="mb-3 text-xl font-semibold">
          Inventory movements
        </h3>
        <ul className="space-y-3">
          {movements
            .slice()
            .reverse()
            .map((m) => (
              <li key={m.id} className="rounded-xl bg-secondary p-3 text-sm">
                <p className="font-semibold">
                  {products.flatMap((p) => p.variants).find((v) => v.id === m.variant_id)?.sku ??
                    "Archived SKU"}
                  : {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </p>
                <p>{m.reason}</p>
                <p className="text-muted-foreground">
                  {new Date(m.created_at * 1000).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}
                </p>
              </li>
            ))}
        </ul>
        {!movements.length && <p>No stock movements yet.</p>}
      </section>
    </section>
  );
}
