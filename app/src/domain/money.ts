// Amounts are handled in whole cents so totals always agree with rows (D-043).

/**
 * Reads an amount typed by a person, such as "452.3", "$1,234.56" or "12".
 * Returns whole cents, or null if the text is not a valid amount.
 * Negative amounts and more than two decimals are not valid.
 */
export function parseAmountToCents(input: string): number | null {
  const text = input.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(text) && !/^\.\d{1,2}$/.test(text)) {
    return null;
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole || '0') * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** "$1,234.56" for display. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${whole}.${String(abs % 100).padStart(2, '0')}`;
}

/** "1234.56" for files: no currency sign, no thousands separator (D-045). */
export function centsToPlain(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
