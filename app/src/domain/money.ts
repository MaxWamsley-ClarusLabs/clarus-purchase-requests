// Amounts are handled in whole cents so totals always agree with rows (D-043).

/**
 * The largest amount the app accepts, $10,000,000.00. Not a policy limit: a
 * check that an amount was typed as meant (a slipped key, a pasted account
 * number).
 */
export const MAX_AMOUNT_CENTS = 1000000000;

/**
 * Reads an amount typed by a person, such as "452.3", "$1,234.56" or "12".
 * Returns whole cents, or null if the text is not a valid amount.
 * A comma is accepted only between groups of three digits ("1,234.56"), so a
 * decimal comma ("12,50") is refused rather than read as 1,250.00. Negative
 * amounts, more than two decimals and amounts over MAX_AMOUNT_CENTS are not valid.
 */
export function parseAmountToCents(input: string): number | null {
  const text = input.trim().replace(/^\$\s*/, '');
  let plain: string;
  if (/^\d{1,3}(,\d{3})+(\.\d{0,2})?$/.test(text)) plain = text.replace(/,/g, '');
  else if (/^\d+(\.\d{0,2})?$/.test(text) || /^\.\d{1,2}$/.test(text)) plain = text;
  else return null;
  const [whole, fraction = ''] = plain.split('.');
  const cents = Number(whole || '0') * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isSafeInteger(cents) && cents <= MAX_AMOUNT_CENTS ? cents : null;
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

/**
 * "$500" for whole-dollar amounts and "$500.50" otherwise, for prose such as
 * the approval threshold in messages and the Instructions.
 */
export function formatDollars(cents: number): string {
  return cents % 100 === 0 ? formatCents(cents).replace(/\.00$/, '') : formatCents(cents);
}
