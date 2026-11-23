import type { Selection } from "@/lib/order-lines";

/** The customer's selections for one order line, e.g. "1 × Colour: Red", saved with the order. */
export function SelectionList({ selections }: { selections: Selection[] }) {
  const chosen = selections.filter((s) => s.note);
  if (!chosen.length) return null;
  return (
    <ul className="ml-4 list-disc text-xs text-muted-foreground" data-selections>
      {selections.map((s, index) => (
        <li key={`${s.note ?? ""}-${index}`}>
          {s.qty} × {s.note ?? "No selection"}
        </li>
      ))}
    </ul>
  );
}
