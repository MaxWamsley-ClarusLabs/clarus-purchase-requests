// Shipping and sales tax while the approver buys (P-048). Two optional boxes per vendor in the
// Vendor totals card keep one ordinary row for each, so every extra charge is still a row with
// its own category, and the CSV and the QuickBooks entries stay one line per account.
//
// A row made by a box carries a `rowKind` ('shipping' or 'tax'), which is how the box finds it
// again. The kind is only a label for the boxes: it changes no total, rule or file.

import { messages } from './messages';
import { receiptFiles, receiptSourceRow } from './receipts';
import { vendorKey } from './purchaseRules';
import { LineChanges } from '../data/PurchaseDataService';
import { CategoryId, IsoDate, PurchaseLine, RowKind } from './types';

export type ExtraKind = Exclude<RowKind, ''>;

export const EXTRA_KINDS: readonly ExtraKind[] = ['shipping', 'tax'];

/** What the row made by each box says it is. */
export const EXTRA_DESCRIPTION: Record<ExtraKind, string> = { shipping: 'Shipping', tax: 'Sales tax' };

/** The category of a shipping row. Tax takes the category of the vendor's largest purchase. */
export const SHIPPING_CATEGORY: CategoryId = 'shipping';

/** A stored row kind as one of the known kinds; anything else is an ordinary row. */
export function normalizeRowKind(value: unknown): RowKind {
  return value === 'shipping' || value === 'tax' ? value : '';
}

/** A vendor's rows in row order. A row with no vendor has no vendor group to belong to. */
function vendorRowsOf(lines: readonly PurchaseLine[], key: string): PurchaseLine[] {
  if (key === '') return [];
  return lines.filter((l) => vendorKey(l.vendor) === key).sort((a, b) => a.rowNumber - b.rowNumber);
}

/** The shipping or tax a vendor has now: the rows the box keeps, and their total (null when there are none). */
export function extraChargeOf(lines: readonly PurchaseLine[], key: string, kind: ExtraKind): { cents: number | null; lineIds: string[] } {
  const rows = vendorRowsOf(lines, key).filter((l) => l.rowKind === kind);
  if (rows.length === 0) return { cents: null, lineIds: [] };
  return { cents: rows.reduce((sum, l) => sum + Math.max(0, l.amountCents ?? 0), 0), lineIds: rows.map((l) => l.id) };
}

/**
 * The row that holds the receipt files a new shipping or tax row of this vendor can share: the
 * first purchase of the vendor, in row order, whose receipt exists, whether it holds it or shares it.
 */
export function receiptHolderFor(lines: readonly PurchaseLine[], key: string): PurchaseLine | undefined {
  for (const row of vendorRowsOf(lines, key).filter((l) => l.rowKind === '')) {
    const holder = receiptSourceRow(row, lines);
    if (holder && receiptFiles(holder).length > 0) return holder;
  }
  return undefined;
}

/** Whether the box can start a shipping or tax row for this vendor: one already exists, or there is a receipt to share. */
export function canSetExtra(lines: readonly PurchaseLine[], key: string, kind: ExtraKind): boolean {
  return extraChargeOf(lines, key, kind).lineIds.length > 0 || receiptHolderFor(lines, key) !== undefined;
}

export interface ExtraPlan {
  /** Rows to delete: the box was emptied, or more than one row had been kept. */
  remove: string[];
  /** The row to change, when one exists already. */
  update?: { lineId: string; changes: LineChanges };
  /** The fields of the row to make, when none exists. */
  create?: LineChanges;
  /** Why nothing was done, in words for the person buying. */
  refusal?: string;
}

/** The category of the vendor's largest purchase that has one, the earliest row first on a tie; empty when none has. */
function largestPurchaseCategory(items: readonly PurchaseLine[]): CategoryId | '' {
  let best: PurchaseLine | undefined;
  for (const row of items) {
    if (!row.category) continue;
    if (!best || (row.amountCents ?? 0) > (best.amountCents ?? 0)) best = row;
  }
  return best ? best.category : '';
}

/**
 * What typing `cents` into a vendor's shipping or tax box changes. An empty or zero box removes the
 * row. A box with an amount changes the row it keeps, or makes one that copies the vendor, the date
 * of its first purchase and its receipt (the row shares it), with the shipping category, or for
 * tax the category of the vendor's largest purchase. The person buying can still change that row.
 */
export function planExtraCharge(lines: readonly PurchaseLine[], key: string, kind: ExtraKind, cents: number | null, today: IsoDate): ExtraPlan {
  const rows = vendorRowsOf(lines, key);
  const existing = rows.filter((l) => l.rowKind === kind);
  if (cents === null || cents <= 0) return { remove: existing.map((l) => l.id) };
  if (existing.length > 0) {
    return { remove: existing.slice(1).map((l) => l.id), update: { lineId: existing[0].id, changes: { amountCents: cents } } };
  }
  const items = rows.filter((l) => l.rowKind === '');
  const holder = receiptHolderFor(lines, key);
  if (items.length === 0 || !holder) return { remove: [], refusal: messages.extraNeedsReceipt };
  return {
    remove: [],
    create: {
      vendor: items[0].vendor,
      description: EXTRA_DESCRIPTION[kind],
      category: kind === 'shipping' ? SHIPPING_CATEGORY : largestPurchaseCategory(items),
      date: items.find((l) => l.date)?.date ?? today,
      quantity: 1,
      amountCents: cents,
      paidBy: 'company',
      itemLink: '',
      sameReceiptAsRow: holder.rowNumber,
      rowKind: kind
    }
  };
}
