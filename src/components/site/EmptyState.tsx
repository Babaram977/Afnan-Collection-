import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";
export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-12 text-center"
    >
      <div
        className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-primary"
        aria-hidden
      >
        {icon ?? <PackageOpen className="size-7" />}
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
