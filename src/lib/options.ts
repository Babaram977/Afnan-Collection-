/** Splits "Blue, Black, Sky blue" (or "/"-separated) into choices; a single value or range stays one. */
export function choicesOf(value: string | undefined): string[] {
  const parts = (value ?? "")
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? [...new Set(parts)] : [];
}

/** Text recorded with a cart line: chosen size/colour plus the customer's note. */
export function lineNote(
  choice: { size?: string; color?: string },
  note: string,
): string | undefined {
  const parts = [
    choice.size && `Size: ${choice.size}`,
    choice.color && `Colour: ${choice.color}`,
    note.trim() && `Note: ${note.trim()}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ").slice(0, 200) : undefined;
}

/** Identity of a cart line: the variant plus the customer's chosen options/note. */
export const lineKey = (l: { variantId: string; note?: string | undefined }) =>
  `${l.variantId}|${l.note ?? ""}`;

/** Cart display label: drops list fields ("Blue, Black, Ash") because the customer's choice is in the note. */
export function chosenLabel(variantLabel: string): string {
  return variantLabel
    .split(" · ")
    .filter((part) => part && choicesOf(part).length === 0)
    .join(" · ");
}
