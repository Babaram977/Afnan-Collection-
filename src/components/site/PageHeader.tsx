import type { ReactNode } from "react";
export function PageHeader({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b bg-secondary/50">
      <div className="container-page py-8 md:py-12">
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>}
        {children}
      </div>
    </div>
  );
}
