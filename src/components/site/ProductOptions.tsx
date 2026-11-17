import type { ProductVariant } from "@/lib/catalog";
import { choicesOf } from "@/lib/options";

function Chips({
  legend,
  options,
  selected,
  onSelect,
  disabled = () => false,
  soldOut = () => false,
}: {
  legend: string;
  options: string[];
  selected: string | undefined;
  onSelect: (value: string) => void;
  disabled?: (value: string) => boolean;
  soldOut?: (value: string) => boolean;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-semibold">
        {legend}
        {selected && <span className="font-normal text-muted-foreground">: {selected}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onSelect(o)}
            aria-pressed={o === selected}
            aria-label={soldOut(o) ? `${o} (sold out)` : undefined}
            disabled={disabled(o)}
            className={`min-h-11 rounded-full border bg-card px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground ${soldOut(o) ? "text-muted-foreground line-through decoration-1" : ""}`}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Size and colour selection.
 * - Several variants: separate Size and Colour groups pick the matching variant (each has its own
 *   price and stock); combinations that do not exist are disabled.
 * - A variant whose size or colour lists several values ("Blue, Black, Ash") offers those values
 *   as a required choice, recorded with the cart line.
 */
export function ProductOptions({
  variants,
  variantId,
  onVariant,
  choice,
  onChoice,
}: {
  variants: ProductVariant[];
  variantId: string | undefined;
  onVariant: (id: string) => void;
  choice: { size?: string; color?: string };
  onChoice: (c: { size?: string; color?: string }) => void;
}) {
  const v = variants.find((x) => x.id === variantId);
  const sizes = [...new Set(variants.map((x) => x.size).filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((x) => x.color).filter(Boolean))] as string[];
  const pick = (size: string | undefined, color: string | undefined) => {
    const match =
      variants.find((x) => (size ? x.size === size : true) && (color ? x.color === color : true)) ??
      variants.find((x) => (size ? x.size === size : x.color === color));
    if (match) onVariant(match.id);
    onChoice({});
  };
  // Identical variant labels (e.g. two options both entered as "4-8 · Blue, Red") are numbered so
  // customers can tell them apart; selection is by variant id, never by label.
  const base = variants.map((x) => [x.size, x.color].filter(Boolean).join(" · ") || x.sku);
  const optionLabels = variants.map((x, i) => ({
    id: x.id,
    stock: x.stock,
    label:
      base.filter((b) => b === base[i]).length > 1
        ? `${base[i]} (option ${base.slice(0, i + 1).filter((b) => b === base[i]).length})`
        : base[i]!,
  }));
  const sizeChoices = choicesOf(v?.size);
  const colorChoices = choicesOf(v?.color);
  return (
    <div data-product-options>
      {variants.length > 1 && sizes.length > 1 && (
        <Chips
          legend="Size"
          options={sizes}
          selected={v?.size}
          onSelect={(s) => pick(s, colors.length > 1 ? v?.color : undefined)}
          soldOut={(s) => {
            const matching = variants.filter((x) => x.size === s);
            return matching.length > 0 && matching.every((x) => x.stock === 0);
          }}
        />
      )}
      {variants.length > 1 && colors.length > 1 && (
        <Chips
          legend="Colour"
          options={colors}
          selected={v?.color}
          onSelect={(c) => pick(sizes.length > 1 ? v?.size : undefined, c)}
          disabled={(c) =>
            sizes.length > 1 && !variants.some((x) => x.color === c && x.size === v?.size)
          }
          soldOut={(c) => {
            // A combination that does not exist is disabled, not "sold out".
            const matching = variants.filter(
              (x) => x.color === c && (sizes.length <= 1 || x.size === v?.size),
            );
            return matching.length > 0 && matching.every((x) => x.stock === 0);
          }}
        />
      )}
      {variants.length > 1 && sizes.length <= 1 && colors.length <= 1 && (
        <Chips
          legend="Option"
          options={optionLabels.map((o) => o.label)}
          selected={optionLabels.find((o) => o.id === variantId)?.label}
          onSelect={(label) => {
            const match = optionLabels.find((o) => o.label === label);
            if (match) onVariant(match.id);
            onChoice({});
          }}
          soldOut={(label) => optionLabels.find((o) => o.label === label)?.stock === 0}
        />
      )}
      {variants.length === 1 && v?.size && !sizeChoices.length && (
        <p className="mt-5 text-sm">
          <span className="font-semibold">Size:</span> {v.size}
        </p>
      )}
      {sizeChoices.length > 0 && (
        <Chips
          legend="Choose size"
          options={sizeChoices}
          selected={choice.size}
          onSelect={(s) => onChoice({ ...choice, size: s })}
        />
      )}
      {variants.length === 1 && v?.color && !colorChoices.length && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Colour:</span> {v.color}
        </p>
      )}
      {colorChoices.length > 0 && (
        <Chips
          legend="Choose colour"
          options={colorChoices}
          selected={choice.color}
          onSelect={(c) => onChoice({ ...choice, color: c })}
        />
      )}
    </div>
  );
}
