/**
 * Order lines and the customer's selections (PR #41 follow-up, owner-approved 2026-11-22).
 *
 * A cart can hold the same product option (variant) more than once with different selections,
 * e.g. one gown in "Colour: Red" and one in "Colour: Blue". Price and stock belong to the variant,
 * so the order stores ONE order_items row per variant (its quantity is the sum, which the
 * reserve_stock trigger checks and reserves atomically), and keeps every distinct selection with
 * its own quantity in order_items.selections. Identical selections are combined; distinct ones are
 * never merged.
 */
export interface OrderLineInput {
  variantId: string;
  qty: number;
  /** The cart line's selection text ("Size: M · Colour: Red · Note: …"); absent when none. */
  note?: string | undefined;
}
export interface Selection {
  qty: number;
  note: string | null;
}
export interface VariantLine {
  variantId: string;
  qty: number;
  selections: Selection[];
}
/** Largest quantity of one variant in an order (order_items.qty CHECK BETWEEN 1 AND 99). */
export const MAX_QTY_PER_VARIANT = 99;

const normalize = (note: string | undefined) => {
  const value = note?.trim();
  return value ? value : null;
};

/** Groups cart lines by variant, combining identical selections and keeping distinct ones. */
export function groupOrderLines(lines: OrderLineInput[]): VariantLine[] {
  const byVariant = new Map<string, Map<string | null, number>>();
  for (const line of lines) {
    const selections = byVariant.get(line.variantId) ?? new Map<string | null, number>();
    const note = normalize(line.note);
    selections.set(note, (selections.get(note) ?? 0) + line.qty);
    byVariant.set(line.variantId, selections);
  }
  return [...byVariant].map(([variantId, selections]) => ({
    variantId,
    qty: [...selections.values()].reduce((n, q) => n + q, 0),
    selections: [...selections].map(([note, qty]) => ({ qty, note })),
  }));
}

/** Canonical, order-independent form of the lines, for idempotency request hashing. */
export function canonicalLines(lines: OrderLineInput[]) {
  return groupOrderLines(lines)
    .map((l) => ({
      ...l,
      selections: [...l.selections].sort((a, b) => (a.note ?? "").localeCompare(b.note ?? "")),
    }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));
}

/** Parses order_items.selections; legacy rows (NULL) and malformed values give an empty list. */
export function parseSelections(value: unknown): Selection[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (s): s is Selection =>
            typeof s === "object" &&
            s !== null &&
            Number.isInteger((s as Selection).qty) &&
            ((s as Selection).note === null || typeof (s as Selection).note === "string"),
        )
      : [];
  } catch {
    return [];
  }
}
