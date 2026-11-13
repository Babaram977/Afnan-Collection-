import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/policies")({
  head: () => ({ meta: [{ title: "Policies — Afnan Collection Online" }, { name: "description", content: "Delivery, returns, privacy and terms for Afnan Collection Online." }, { property: "og:title", content: "Policies — Afnan Collection Online" }, { property: "og:description", content: "Delivery, returns, privacy and terms for Afnan Collection Online." }] }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Policies" intro="Delivery, returns, privacy and terms for Afnan Collection Online." />
      <div className="container-page py-8"><ul className="grid gap-4 md:grid-cols-2">{["Delivery", "Returns & exchanges", "Privacy", "Terms of sale"].map((t) => (<li key={t} className="rounded-2xl bg-card p-6 shadow-soft"><h2 className="text-xl font-semibold">{t}</h2><p className="mt-2 text-sm text-muted-foreground">This policy has not been published yet.</p></li>))}</ul></div>
    </>
  );
}
