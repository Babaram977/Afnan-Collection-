import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — Afnan Collection Online" }, { name: "description", content: "How to reach Afnan Collection Online." }, { property: "og:title", content: "Contact — Afnan Collection Online" }, { property: "og:description", content: "How to reach Afnan Collection Online." }] }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="Contact" intro="How to reach Afnan Collection Online." />
      <div className="container-page py-8"><EmptyState title="Contact details coming soon">Official phone, email and address details have not been published yet. They will appear here once confirmed by the store.</EmptyState></div>
    </>
  );
}
