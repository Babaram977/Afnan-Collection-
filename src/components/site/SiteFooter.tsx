import { Link } from "@tanstack/react-router";
import { Wordmark } from "./Wordmark";
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/60">
      <div className="container-page grid gap-8 py-10 md:grid-cols-3">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Clothing, essentials, toys and gifts for children in Nigeria.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-2 text-sm font-semibold">
            <li>
              <Link to="/shop" className="hover:text-primary">
                Shop
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-primary">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/policies" className="hover:text-primary">
                Policies
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-primary">
                Admin
              </Link>
            </li>
          </ul>
        </nav>
        <p className="text-sm text-muted-foreground md:text-right">
          © {new Date().getFullYear()} Afnan Collection Online
        </p>
      </div>
    </footer>
  );
}
