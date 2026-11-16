import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const GROUPS: { label: string; tabs: string[] }[] = [
  { label: "Sales", tabs: ["overview", "orders", "payments", "customers"] },
  { label: "Catalogue", tabs: ["products", "inventory", "categories", "zones"] },
  { label: "Storefront", tabs: ["banners", "content"] },
  { label: "Settings", tabs: ["business", "audit"] },
];
const tabLabel = (tab: string) => `${tab[0]?.toUpperCase() ?? ""}${tab.slice(1)}`;

/**
 * Administrator section navigation. Phones get a single bar with the current section and a
 * "Sections" panel; tablets and desktops keep one row of grouped buttons.
 */
export function AdminNav({
  tabs,
  current,
  onSelect,
}: {
  tabs: string[];
  current: string;
  onSelect: (tab: string) => void;
}) {
  const groups = GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((t) => tabs.includes(t)) })).filter(
    (g) => g.tabs.length,
  );
  return (
    <>
      <nav
        aria-label="Administration"
        className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2 md:hidden"
      >
        <p className="min-w-0 truncate text-base font-medium" aria-live="polite">
          {tabLabel(current)}
        </p>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 gap-2"
              aria-label="Admin sections"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Sections
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto bg-background">
            <SheetHeader>
              <SheetTitle className="font-display text-lg font-medium">Store management</SheetTitle>
              <SheetDescription>Choose a section</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  <h3 className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {g.label}
                  </h3>
                  <ul className="space-y-0.5">
                    {g.tabs.map((t) => (
                      <li key={t}>
                        <SheetClose asChild>
                          <button
                            type="button"
                            aria-current={t === current ? "page" : undefined}
                            onClick={() => onSelect(t)}
                            className={`block w-full rounded-lg px-3 py-2.5 text-left text-[0.95rem] transition ${
                              t === current
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-secondary"
                            }`}
                          >
                            {tabLabel(t)}
                          </button>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
      <nav aria-label="Administration" className="hidden flex-wrap items-center gap-y-2 md:flex">
        {groups.map((g, i) => (
          <div
            key={g.label}
            role="group"
            aria-label={g.label}
            className={`flex flex-wrap gap-1.5 ${i ? "ml-3 border-l pl-3" : ""}`}
          >
            {g.tabs.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={t === current ? "default" : "outline"}
                aria-current={t === current ? "page" : undefined}
                onClick={() => onSelect(t)}
              >
                {tabLabel(t)}
              </Button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl tabular-nums md:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
