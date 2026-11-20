import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep old bookmarks and callbacks valid without changing any session or customer data.
export const Route = createFileRoute("/account")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true, statusCode: 302 });
  },
});
