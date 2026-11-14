import { useBusiness } from "@/components/site/BusinessProvider";
import { StoreContent } from "@/components/site/StoreContent";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies — Afnan Collection Online" },
      {
        name: "description",
        content: "Delivery, returns, privacy and terms for Afnan Collection Online.",
      },
      { property: "og:title", content: "Policies — Afnan Collection Online" },
      {
        property: "og:description",
        content: "Delivery, returns, privacy and terms for Afnan Collection Online.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const business = useBusiness();
  return (
    <>
      <PageHeader
        title="Policies"
        intro="Delivery, returns, privacy and terms for Afnan Collection Online."
      />
      <div className="container-page py-8">
        <ul className="grid gap-4 md:grid-cols-2">
          {["Delivery", "Returns & exchanges", "Privacy"].map((t) => (
            <li key={t} className="rounded-2xl bg-card p-6 shadow-soft">
              <h2 className="text-xl font-semibold">{t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <StoreContent
                  name={
                    t.startsWith("Delivery")
                      ? "delivery"
                      : t.startsWith("Returns")
                        ? "returns"
                        : "privacy"
                  }
                  fallback="This policy has not been published yet."
                />
              </p>
            </li>
          ))}
        </ul>
        <section
          className="mt-8 rounded-2xl bg-card p-6 shadow-soft"
          aria-labelledby="business-legal"
        >
          <h2 id="business-legal" className="text-xl font-semibold">
            Business information
          </h2>
          <p className="mt-3 font-semibold">{business.name}</p>
          <p className="mt-2">{business.address}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">CAC business number</dt>
              <dd>{business.cacBusinessNumber}</dd>
            </div>
            <div>
              <dt className="font-semibold">Tax identification number</dt>
              <dd>{business.tin}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Registration and tax numbers are supplied by the owner and have not been independently
            verified.
          </p>
        </section>
      </div>
    </>
  );
}
