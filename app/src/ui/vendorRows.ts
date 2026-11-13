// What the vendor totals table shows for each vendor in a request (P-015,
// P-016, P-019). Pure functions: the screens only draw what is worked out here,
// from the rules in domain/purchaseRules.ts.

import { messages } from '../domain/messages';
import { formatCents } from '../domain/money';
import { LineApprovalStatus, VendorGroup, lineApprovals, vendorGroups } from '../domain/purchaseRules';
import { quoteFiles } from '../domain/receipts';
import { BuyerId, PurchaseLine, PurchaseRequest } from '../domain/types';
import { listText } from './text';

export type QuoteStatus =
  /** A quote file is attached to one of the vendor's rows. */
  | { kind: 'attached' }
  /** No quote file, but a row says why there is none. */
  | { kind: 'reason'; reason: string }
  /** The vendor total needs a quote and there is neither a quote nor a reason. */
  | { kind: 'missing' }
  /** The vendor total is under the quote threshold. */
  | { kind: 'notNeeded' };

export interface VendorRow {
  group: VendorGroup;
  /** Row numbers of the vendor's rows, in order. */
  rows: number[];
  approval: LineApprovalStatus;
  /** What the approver approved for this vendor; null when nothing was approved. */
  approvedCents: number | null;
  quote: QuoteStatus;
  /** The purchase looked already bought when the request was sent for approval (P-017). */
  boughtBefore: boolean;
}

/** The approval column's words in the vendor totals table: the grid's and the CSV's words for "not needed" (LINE_APPROVAL_DISPLAY). */
export const VENDOR_APPROVAL_LABEL: Record<LineApprovalStatus, string> = {
  notRequired: 'Not required',
  needed: 'Needed',
  pending: 'Awaiting approval',
  approved: 'Approved',
  changed: 'Changed since approval'
};

/** "Attached", "No quote: <reason>", "Missing", or "" when no quote is needed: the vendor totals table's Quote column. */
export function quoteText(quote: QuoteStatus): string {
  switch (quote.kind) {
    case 'attached':
      return 'Attached';
    case 'reason':
      return `No quote: ${quote.reason}`;
    case 'missing':
      return 'Missing';
    case 'notNeeded':
      return '';
  }
}

/** The quote in a sentence, after "Quote: ": "attached", "none (reason given: <reason>)", "missing" or "not required". */
export function quoteSummary(quote: QuoteStatus): string {
  switch (quote.kind) {
    case 'attached':
      return 'attached';
    case 'reason':
      return `none (reason given: ${quote.reason})`;
    case 'missing':
      return 'missing';
    case 'notNeeded':
      return 'not required';
  }
}

/** Vendors as the start of a sentence: "Acme Lab Supply and Kestrel Instruments". */
function vendorsText(vendors: readonly string[]): string {
  const names = listText(vendors.map((v) => v.trim() || 'a purchase with no vendor'));
  return `${names.charAt(0).toUpperCase()}${names.slice(1)}`;
}

/**
 * The send dialog's note for the vendor totals that will be flagged Bought
 * before approval (P-017), naming them: those that look already bought, and
 * those an earlier round flagged, which stay flagged. For example "Northwind
 * Office Supply looks already bought. It will be flagged Bought before
 * approval. You can still send it." '' when there are none.
 */
export function boughtBeforeNote(looksBought: readonly string[], flaggedEarlier: readonly string[] = []): string {
  const parts: string[] = [];
  if (looksBought.length === 1) parts.push(`${vendorsText(looksBought)} looks already bought. It will be flagged Bought before approval.`);
  if (looksBought.length > 1) parts.push(`${vendorsText(looksBought)} look already bought. They will be flagged Bought before approval.`);
  if (flaggedEarlier.length === 1) parts.push(`${vendorsText(flaggedEarlier)} was flagged Bought before approval when it was sent before, and stays flagged.`);
  if (flaggedEarlier.length > 1) parts.push(`${vendorsText(flaggedEarlier)} were flagged Bought before approval when they were sent before, and stay flagged.`);
  if (parts.length === 0) return '';
  parts.push(looksBought.length + flaggedEarlier.length === 1 ? 'You can still send it.' : 'You can still send the request.');
  return parts.join(' ');
}

/** `buyer` is who buys the request; the employee when it is not given (P-037). */
export function vendorRows(lines: readonly PurchaseLine[], request: Pick<PurchaseRequest, 'status' | 'approval'> & { buyer?: BuyerId }): VendorRow[] {
  const buyer = request.buyer ?? 'self';
  const approvals = lineApprovals(lines, request.status, request.approval, buyer);
  const approvedBy = new Map(request.approval.approved.map((a) => [a.key, a.cents]));
  const byId = new Map(lines.map((l) => [l.id, l]));
  return vendorGroups(lines, buyer).map((group) => {
    const groupLines = group.lineIds.map((id) => byId.get(id)).filter((l): l is PurchaseLine => !!l);
    const first = approvals.get(group.lineIds[0]);
    const reason = groupLines.map((l) => l.noQuoteReason.trim()).find((r) => r !== '');
    let quote: QuoteStatus;
    if (groupLines.some((l) => quoteFiles(l).length > 0)) quote = { kind: 'attached' };
    else if (reason) quote = { kind: 'reason', reason };
    else quote = group.needsQuote ? { kind: 'missing' } : { kind: 'notNeeded' };
    return {
      group,
      rows: groupLines.map((l) => l.rowNumber).sort((a, b) => a - b),
      approval: first ? first.status : 'notRequired',
      approvedCents: approvedBy.get(group.key) ?? null,
      quote,
      boughtBefore: first ? first.boughtBefore : false
    };
  });
}

/** "Row 1" or "Rows 1, 3". */
export function rowsText(rows: readonly number[]): string {
  return rows.length === 1 ? `Row ${rows[0]}` : `Rows ${rows.join(', ')}`;
}

/** What to tell the employee or the approver about each vendor total that rose past the allowance, or was never approved (P-019). */
export function changedMessages(rows: readonly VendorRow[]): string[] {
  return rows
    .filter((r) => r.approval === 'changed')
    .map((r) =>
      r.approvedCents === null
        ? messages.notApproved(r.group.vendor, formatCents(r.group.totalCents))
        : messages.changedSinceApproval(r.group.vendor, formatCents(r.group.totalCents), formatCents(r.approvedCents))
    );
}
