// Default values and suggestions (travel D-057). Defaults only fill empty
// fields; the employee can always change them.

import { vendorKey } from './purchaseRules';
import { CategoryId, PaidById, PurchaseLine, PurchaseRequest, SuggestedField } from './types';

/** The quick picks for "No quote" and "No receipt" are policy, kept in purchaseRules.ts (P-004); exported here as well for the screens. */
export { NO_QUOTE_REASONS, NO_RECEIPT_REASONS } from './purchaseRules';

/**
 * "Who paid" for the first row of a request (P-023, Provisional). Max has not
 * said which is more common for purchases; in travel, company card was by far
 * the most common payment (travel D-057).
 */
export const FIRST_ROW_PAID_BY: PaidById = 'company';

/**
 * "Who paid" for a new row: the same as the row above, or the first-row
 * default for the first row of a request.
 */
export function defaultPaidBy(existingLines: readonly PurchaseLine[]): PaidById {
  const above = [...existingLines].sort((a, b) => a.rowNumber - b.rowNumber).pop();
  return above && above.paidBy ? above.paidBy : FIRST_ROW_PAID_BY;
}

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The latest value of `field` on the employee's earlier rows with this vendor.
 * `history` is ordered oldest first. Values the employee has not confirmed
 * (travel D-078) are not remembered.
 */
function lastUsed<K extends 'category' | 'paidBy'>(vendor: string, history: readonly PurchaseLine[], field: K): PurchaseLine[K] | undefined {
  const key = vendorKey(vendor);
  if (!key) return undefined;
  const unconfirmed = (line: PurchaseLine, f: SuggestedField) => (line.suggested ?? []).includes(f);
  let found: PurchaseLine[K] | undefined;
  for (const line of history) {
    if (line[field] && vendorKey(line.vendor) === key && !unconfirmed(line, 'vendor') && !unconfirmed(line, field)) found = line[field];
  }
  return found;
}

/**
 * The category used the last time this vendor appeared in the employee's
 * purchases, or undefined if the vendor is new. `history` should be ordered
 * oldest first; the latest use wins.
 */
export function suggestCategoryForVendor(vendor: string, history: readonly PurchaseLine[]): CategoryId | undefined {
  return (lastUsed(vendor, history, 'category') as CategoryId | '' | undefined) || undefined;
}

/** "Who paid" from the last time the employee used this vendor (vendor memory, travel D-074). */
export function suggestPaidByForVendor(vendor: string, history: readonly PurchaseLine[]): PaidById | undefined {
  return (lastUsed(vendor, history, 'paidBy') as PaidById | '' | undefined) || undefined;
}

/** The employee's own spelling of a vendor they used before ("City Cab Co." for "CITY CAB CO"), or undefined. */
export function knownVendorName(vendor: string, history: readonly PurchaseLine[]): string | undefined {
  const key = vendorKey(vendor);
  if (!key) return undefined;
  let found: string | undefined;
  for (const line of history) {
    if (vendorKey(line.vendor) === key && !(line.suggested ?? []).includes('vendor')) found = line.vendor.trim();
  }
  return found;
}

/** Vendors the employee has used before, most used first, for autocomplete. Spellings of one vendor (`vendorKey`) are listed once. */
export function vendorSuggestions(history: readonly PurchaseLine[]): string[] {
  return mostUsed(
    history.map((l) => l.vendor),
    vendorKey
  );
}

/** Departments on the employee's earlier requests, most used first. */
export function departmentSuggestions(requests: readonly PurchaseRequest[]): string[] {
  return mostUsed(requests.map((r) => r.department));
}

/** The department on the employee's latest request that has one, to fill in a new request (P-022). */
export function latestDepartment(requests: readonly PurchaseRequest[]): string {
  const sorted = requests.filter((r) => r.department.trim()).sort((a, b) => b.lastChanged.localeCompare(a.lastChanged) || b.id - a.id);
  return sorted.length > 0 ? sorted[0].department.trim() : '';
}

function mostUsed(values: readonly string[], keyOf: (text: string) => string = normalise): string[] {
  const counts = new Map<string, { text: string; count: number }>();
  for (const v of values) {
    const key = keyOf(v);
    if (!key) continue;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { text: v.trim(), count: 1 });
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .map((e) => e.text);
}
