// Request totals (P-011): lines the employee paid are "To reimburse", lines the
// company paid are "Paid by Clarus", and the request total counts every line
// with an amount. While a draft still has rows without "who paid", the request
// total can be more than the other two added together.

import { findPaidBy } from './purchaseRules';
import { BuyerId, PurchaseLine } from './types';

export interface Totals {
  reimburseCents: number;
  companyCents: number;
  requestCents: number;
}

/**
 * When the approver buys (P-037), the company pays for every row, whatever a
 * row's stored "who paid" says, so nothing is "To reimburse".
 */
export function computeTotals(lines: readonly PurchaseLine[], buyer: BuyerId = 'self'): Totals {
  let reimburseCents = 0;
  let companyCents = 0;
  let requestCents = 0;
  for (const line of lines) {
    if (line.amountCents === null) continue;
    requestCents += line.amountCents;
    const paidBy = findPaidBy(buyer === 'approver' ? 'company' : line.paidBy);
    if (!paidBy) continue;
    if (paidBy.reimbursable) reimburseCents += line.amountCents;
    else companyCents += line.amountCents;
  }
  return { reimburseCents, companyCents, requestCents };
}
