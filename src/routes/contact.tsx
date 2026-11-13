import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { BusinessContact } from "@/components/site/BusinessContact";
import { business as defaultBusiness } from "@/lib/business";
import { useBusiness } from "@/components/site/BusinessProvider";
import { loadBusiness } from "@/lib/store";
export const Route = createFileRoute("/contact")({
  loader: () => loadBusiness(),
  head: ({ loaderData }) => {
    const business = loaderData ?? defaultBusiness;
    return {
      meta: [
        { title: `Contact — ${business.siteName}` },
        {
          name: "description",
          content: `Contact ${business.name} at ${business.address}. WhatsApp ${business.whatsappDisplay}.`,
        },
        { property: "og:title", content: `Contact ${business.name}` },
        {
          property: "og:description",
          content: `Find us in Kano or contact us on WhatsApp: ${business.whatsappDisplay}.`,
        },
      ],
    };
  },
  component: Contact,
});
function Contact() {
  const business = useBusiness();
  return (
    <>
      <PageHeader title="Contact" intro={`Get in touch with ${business.name}.`} />
      <div className="container-page py-8">
        <section
          className="max-w-2xl rounded-2xl bg-card p-6 shadow-soft md:p-8"
          aria-label="Official contact details"
        >
          <h2 className="mb-5 text-2xl font-semibold">Visit or message us</h2>
          <BusinessContact />
          <p className="mt-5 text-sm text-muted-foreground">
            Follow {business.socialHandle} on Instagram and TikTok.
          </p>
        </section>
      </div>
    </>
  );
}
