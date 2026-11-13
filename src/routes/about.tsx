import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — Afnan Collection Online" },
      {
        name: "description",
        content: "Afnan Collection Online is a children's lifestyle store in Nigeria.",
      },
      { property: "og:title", content: "About us — Afnan Collection Online" },
      {
        property: "og:description",
        content: "Afnan Collection Online is a children's lifestyle store in Nigeria.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        title="About us"
        intro="Afnan Collection Online is a children's lifestyle store in Nigeria."
      />
      <div className="container-page py-8">
        <div className="max-w-2xl space-y-4 text-lg">
          <p>
            We bring together clothing, shoes, nursery essentials, feeding and bath accessories,
            toys, books, school supplies and gifts for children — from newborns to school age.
          </p>
          <p className="text-muted-foreground">Our full story will be shared here soon.</p>
        </div>
      </div>
    </>
  );
}
