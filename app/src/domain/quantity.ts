// How many of an item a row is for. A row's amount is always the total for the whole
// row; the quantity only says how many that total covers. Stored in a SharePoint
// column an employee can edit directly (travel D-002), so it is always read back as a
// whole number from 1 to QUANTITY_MAX, whatever was stored.

export const QUANTITY_MAX = 999;

/** A stored or typed quantity as a whole number from 1 to QUANTITY_MAX; anything else is 1. */
export function normalizeQuantity(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.min(QUANTITY_MAX, Math.max(1, Math.round(n)));
}

/**
 * The quantity a typed box means, or null while the text is not yet one (empty, a letter,
 * zero, a fraction or too big): the last good quantity then stays.
 */
export function parseQuantityText(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= QUANTITY_MAX ? n : null;
}
