// Default values and suggestions (D-057). Defaults only fill empty fields; the
// employee can always change them.

import { CategoryId, ExpenseLine, PaymentTypeId, SuggestedField, TravelReport } from './types';

/** Company card is by far the most common payment (checked against the current app's exports, 2026-09-24). */
export const FIRST_ROW_PAYMENT_TYPE: PaymentTypeId = 'companyCard';

/**
 * "Paid with" for a new row: the same as the row above, or Company card for the
 * first row of a report.
 */
export function defaultPaymentType(existingLines: readonly ExpenseLine[]): PaymentTypeId {
  const above = [...existingLines].sort((a, b) => a.rowNumber - b.rowNumber).pop();
  return above && above.paymentType ? above.paymentType : FIRST_ROW_PAYMENT_TYPE;
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A vendor name for matching: capitals, spaces and punctuation ignored ("City Cab Co." is "city cab co"). */
export function vendorKey(vendor: string): string {
  return normalise(vendor.replace(/['\u2019]/g, '').replace(/[^A-Za-z0-9\u00C0-\u024F\s]/g, ' '));
}

/**
 * The latest value of `field` on the employee's earlier rows with this vendor.
 * `history` is ordered oldest first. Values the employee has not confirmed
 * (D-078) are not remembered.
 */
function lastUsed<K extends 'category' | 'paymentType'>(vendor: string, history: readonly ExpenseLine[], field: K): ExpenseLine[K] | undefined {
  const key = vendorKey(vendor);
  if (!key) return undefined;
  const unconfirmed = (line: ExpenseLine, f: SuggestedField) => (line.suggested ?? []).includes(f);
  let found: ExpenseLine[K] | undefined;
  for (const line of history) {
    if (line[field] && vendorKey(line.vendor) === key && !unconfirmed(line, 'vendor') && !unconfirmed(line, field)) found = line[field];
  }
  return found;
}

/**
 * The category used the last time this vendor appeared in the employee's
 * expenses, or undefined if the vendor is new. `history` should be ordered
 * oldest first; the latest use wins.
 */
export function suggestCategoryForVendor(vendor: string, history: readonly ExpenseLine[]): CategoryId | undefined {
  return (lastUsed(vendor, history, 'category') as CategoryId | '' | undefined) || undefined;
}

/** "Paid with" from the last time the employee used this vendor (vendor memory, D-074). */
export function suggestPaymentTypeForVendor(vendor: string, history: readonly ExpenseLine[]): PaymentTypeId | undefined {
  return (lastUsed(vendor, history, 'paymentType') as PaymentTypeId | '' | undefined) || undefined;
}

/** The employee's own spelling of a vendor they used before ("City Cab Co." for "CITY CAB CO"), or undefined. */
export function knownVendorName(vendor: string, history: readonly ExpenseLine[]): string | undefined {
  const key = vendorKey(vendor);
  if (!key) return undefined;
  let found: string | undefined;
  for (const line of history) {
    if (vendorKey(line.vendor) === key && !(line.suggested ?? []).includes('vendor')) found = line.vendor.trim();
  }
  return found;
}

/** Vendors the employee has used before, most used first, for autocomplete. */
export function vendorSuggestions(history: readonly ExpenseLine[]): string[] {
  return mostUsed(history.map((l) => l.vendor));
}

/** Destinations of the employee's earlier reports, most used first. */
export function destinationSuggestions(reports: readonly TravelReport[]): string[] {
  return mostUsed(reports.map((r) => r.destination));
}

/** Quick picks for "No receipt: say why". Free text is still allowed. */
export const NO_RECEIPT_REASONS: readonly string[] = ['Receipt lost', 'No receipt given (cash, tip or meter)'];

function mostUsed(values: readonly string[]): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const v of values) {
    const key = normalise(v);
    if (!key) continue;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { text: v.trim(), count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .map((e) => e.text);
}
