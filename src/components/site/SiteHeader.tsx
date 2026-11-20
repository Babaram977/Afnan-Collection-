import { useEffect, useState } from "react";
import { apiCall, type Me } from "@/lib/store";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { Wordmark } from "./Wordmark";

const NAV = [
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/policies", label: "Policies" },
] as const;

export function SiteHeader() {
  const { count } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    if (admin) {
      setCanManage(false);
      return;
    }
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setCanManage(false);
      void apiCall<Me>("/me", { signal: request.signal })
        .then((me) => {
          if (!request.signal.aborted) setCanManage(me.role === "admin");
        })
        .catch(() => {}); // Fail closed; navigation never supplies authorization.
    };
    refresh();
    window.addEventListener("afnan-auth", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("afnan-auth", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [admin, pathname]);
  const navigation = canManage
    ? [...NAV, { to: "/admin", label: "Store Management" } as const]
    : NAV;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div
        className={`container-page flex items-center justify-between gap-4 ${admin ? "h-16" : "min-h-[87px] lg:h-36"}`}
      >
        <Wordmark placement={admin ? "compact" : "header"} />
        {admin ? (
          <nav aria-label="Store management" className="flex min-w-0 items-center gap-1 sm:gap-3">
            <Link
              to="/admin"
              className="inline-flex min-h-11 max-w-28 items-center rounded-md px-1 py-2 text-sm font-semibold leading-tight sm:max-w-none"
            >
              Store Management
            </Link>
            <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0 px-3">
              <Link to="/">Back to Store</Link>
            </Button>
          </nav>
        ) : (
          <>
            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {navigation.map((n) => (
                  <li key={n.to}>
                    <Link
                      to={n.to}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      activeProps={{ className: "bg-secondary text-foreground" }}
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-1">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative min-h-11 min-w-11"
                aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
              >
                <Link to="/cart">
                  <ShoppingBag className="size-5" />
                  {count > 0 && (
                    <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.65rem] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </Link>
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-background">
                  <SheetHeader>
                    <SheetTitle className="font-display">Menu</SheetTitle>
                  </SheetHeader>
                  <nav aria-label="Mobile" className="px-4">
                    <ul className="flex flex-col gap-1">
                      {[...navigation, { to: "/cart", label: "Cart" } as const].map((n) => (
                        <li key={n.to}>
                          <SheetClose asChild>
                            <Link
                              to={n.to}
                              className="block rounded-xl px-4 py-3 text-base font-semibold hover:bg-secondary"
                            >
                              {n.label}
                            </Link>
                          </SheetClose>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
