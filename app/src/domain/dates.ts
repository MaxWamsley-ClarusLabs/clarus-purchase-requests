// Dates are plain YYYY-MM-DD text (D-043). Comparing such strings compares dates.

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** Today's date in the person's own time zone, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local date and time as "YYYY-MM-DD HH:MM", used for "Submitted on". */
export function toLocalDateTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${toIsoDate(date)} ${h}:${min}`;
}

/**
 * The earliest and latest of the valid dates, for "Purchase dates" (the form's
 * "Purchase Date(s)"). Empty strings when there is no valid date.
 */
export function dateRange(dates: readonly string[]): { first: string; last: string } {
  const valid = dates.filter(isValidIsoDate).sort();
  return { first: valid[0] ?? '', last: valid[valid.length - 1] ?? '' };
}

/** "2026-10-12 to 2026-10-14", one date if they are the same, or '' when there is none. */
export function dateRangeText(dates: readonly string[]): string {
  const { first, last } = dateRange(dates);
  return !first ? '' : first === last ? first : `${first} to ${last}`;
}
