// What the vendor totals table shows for each vendor in a request (P-015,
// P-016, P-019). Pure functions: the screens only draw what is worked out here,
// from the rules in domain/purchaseRules.ts.

import { messages } from '../domain/messages';
import { formatCents } from '../domain/money';
import { LineApprovalStatus, VendorGroup, lineApprovals, vendorGroups } from '../domain/purchaseRules';
import { quoteFiles } from '../domain/receipts';
import { PurchaseLine, PurchaseRequest } from '../domain/types';

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

/** The approval column's words in the vendor totals table. */
export const VENDOR_APPROVAL_LABEL: Record<LineApprovalStatus, string> = {
  notRequired: 'Not needed',
  needed: 'Needed',
  pending: 'Awaiting approval',
  approved: 'Approved',
  changed: 'Changed since approval'
};

/** "Attached", "No quote: <reason>", "Missing", or "" when no quote is needed. */
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

export function vendorRows(lines: readonly PurchaseLine[], request: Pick<PurchaseRequest, 'status' | 'approval'>): VendorRow[] {
  const approvals = lineApprovals(lines, request.status, request.approval);
  const approvedBy = new Map(request.approval.approved.map((a) => [a.key, a.cents]));
  const byId = new Map(lines.map((l) => [l.id, l]));
  return vendorGroups(lines).map((group) => {
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
