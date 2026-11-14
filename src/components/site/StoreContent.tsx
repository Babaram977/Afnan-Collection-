import { useEffect, useState } from "react";
import { apiCall } from "@/lib/store";
interface Store {
  content: { key: string; value: string }[];
  banners: { id: string; title: string; href: string; image_url: string }[];
}
export function StoreContent({ name, fallback }: { name: string; fallback: string }) {
  const [text, setText] = useState(fallback);
  useEffect(() => {
    apiCall<Store>("/store")
      .then((s) => setText(s.content.find((c) => c.key === name)?.value || fallback))
      .catch(() => {});
  }, [name, fallback]);
  return <span className="whitespace-pre-line">{text}</span>;
}
export function StoreBanners() {
  const [banners, setBanners] = useState<Store["banners"]>([]);
  useEffect(() => {
    apiCall<Store>("/store")
      .then((s) => setBanners(s.banners))
      .catch(() => {});
  }, []);
  return banners.length ? (
    <section className="container-page grid gap-4 py-6 md:grid-cols-2" aria-label="Collections">
      {banners.map((b) => (
        <a key={b.id} href={b.href} className="rounded-2xl bg-secondary p-5 font-display text-xl">
          {b.image_url && (
            <img
              src={b.image_url}
              alt=""
              className="mb-3 aspect-[3/1] w-full rounded-xl object-cover"
            />
          )}
          {b.title}
        </a>
      ))}
    </section>
  ) : null;
}
