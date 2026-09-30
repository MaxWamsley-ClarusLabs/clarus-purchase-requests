// Report totals (D-024): reimbursable rows are those paid personally, plus
// mileage (D-071). The trip total counts every row with an amount; while a
// draft still has rows without a payment type, it can be more than To
// reimburse plus Company-paid.

import { findPaymentType } from './lists';
import { mileageAmountCents } from './mileage';
import { ExpenseLine, MileageTrip } from './types';

export interface Totals {
  reimburseCents: number;
  companyCents: number;
  tripCents: number;
}

/** `trips` are the drives that count (activeTrips), paid to the employee. */
export function computeTotals(lines: readonly ExpenseLine[], trips: readonly MileageTrip[] = []): Totals {
  let reimburseCents = 0;
  let companyCents = 0;
  let tripCents = 0;
  for (const line of lines) {
    if (line.amountCents === null) continue;
    tripCents += line.amountCents;
    const payment = findPaymentType(line.paymentType);
    if (!payment) continue;
    if (payment.reimbursable) reimburseCents += line.amountCents;
    else companyCents += line.amountCents;
  }
  for (const trip of trips) {
    const cents = mileageAmountCents(trip);
    if (cents === null) continue;
    reimburseCents += cents;
    tripCents += cents;
  }
  return { reimburseCents, companyCents, tripCents };
}
