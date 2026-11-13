import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CATEGORIES, PRODUCTS, formatNaira, priceRange } from "@/lib/catalog";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { NotConnected } from "@/components/site/StatusBadge";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Afnan Collection Online" }, { name: "description", content: "Store management dashboard." }, { property: "og:title", content: "Admin — Afnan Collection Online" }, { property: "og:description", content: "Store management dashboard." }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-card p-5 shadow-soft"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value}</p></div>;
}
function Soon({ what }: { what: string }) {
  return <EmptyState title={`${what} not connected`} action={<Button disabled>Add {what.toLowerCase()}</Button>}>Managing {what.toLowerCase()} needs a backend and staff sign-in, which are planned for a later phase.</EmptyState>;
}

function Admin() {
  const variants = PRODUCTS.flatMap((p) => p.variants.map((v) => ({ p, v })));
  return (
    <>
      <PageHeader title="Admin dashboard" intro="Preview of store management. Read-only views show local catalogue data; editing is not connected."><div className="mt-3"><NotConnected label="No sign-in · not connected to a backend" /></div></PageHeader>
      <div className="container-page py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Products" value={String(PRODUCTS.length)} /><Stat label="Variants" value={String(variants.length)} />
          <Stat label="Categories" value={String(CATEGORIES.length)} /><Stat label="Orders" value="—" />
        </div>
        <Tabs defaultValue="products" className="mt-8">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {["products", "categories", "variants", "inventory", "orders", "banners"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="products" className="mt-4">{PRODUCTS.length ? (
            <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead></TableRow></TableHeader>
              <TableBody>{PRODUCTS.map((p) => { const r = priceRange(p); return <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.category}</TableCell><TableCell>{r ? formatNaira(r.min) : "—"}</TableCell></TableRow>; })}</TableBody></Table>
          ) : <Soon what="Products" />}</TabsContent>
          <TabsContent value="categories" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">Store category structure (defined in code).</p>
            <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Slug</TableHead><TableHead className="text-right">Products</TableHead></TableRow></TableHeader>
              <TableBody>{CATEGORIES.map((c) => <TableRow key={c.slug}><TableCell className="font-semibold">{c.label}</TableCell><TableCell className="text-muted-foreground">{c.slug}</TableCell><TableCell className="text-right">{PRODUCTS.filter((p) => p.category === c.slug).length}</TableCell></TableRow>)}</TableBody></Table>
          </TabsContent>
          <TabsContent value="variants" className="mt-4">{variants.length ? (
            <Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead>Option</TableHead><TableHead>Price</TableHead></TableRow></TableHeader>
              <TableBody>{variants.map(({ p, v }) => <TableRow key={v.id}><TableCell>{v.sku}</TableCell><TableCell>{p.name}</TableCell><TableCell>{[v.size, v.color].filter(Boolean).join(" · ")}</TableCell><TableCell>{formatNaira(v.priceKobo)}</TableCell></TableRow>)}</TableBody></Table>
          ) : <Soon what="Variants" />}</TabsContent>
          <TabsContent value="inventory" className="mt-4">{variants.length ? (
            <Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead className="text-right">Stock</TableHead></TableRow></TableHeader>
              <TableBody>{variants.map(({ v }) => <TableRow key={v.id}><TableCell>{v.sku}</TableCell><TableCell className="text-right">{v.stock ?? "Not tracked"}</TableCell></TableRow>)}</TableBody></Table>
          ) : <Soon what="Inventory" />}</TabsContent>
          <TabsContent value="orders" className="mt-4"><Soon what="Orders" /></TabsContent>
          <TabsContent value="banners" className="mt-4"><Soon what="Banners" /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}
