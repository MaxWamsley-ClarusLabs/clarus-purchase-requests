import { computeTotals } from './totals';
import { line } from '../testing/builders';

describe('computeTotals (P-011)', () => {
  it('splits "To reimburse" (employee paid) and "Paid by Clarus" (company paid), in cents', () => {
    const totals = computeTotals([
      line({ id: 'a', amountCents: 10010, paidBy: 'employee' }),
      line({ id: 'b', amountCents: 20020, paidBy: 'company' }),
      line({ id: 'c', amountCents: 3, paidBy: 'company' })
    ]);
    expect(totals).toEqual({ reimburseCents: 10010, companyCents: 20023, requestCents: 30033 });
  });

  it('counts rows without "who paid" in the request total only, and skips rows without an amount', () => {
    const totals = computeTotals([line({ id: 'a', amountCents: 500, paidBy: '' }), line({ id: 'b', amountCents: null })]);
    expect(totals).toEqual({ reimburseCents: 0, companyCents: 0, requestCents: 500 });
  });

  it('is zero for an empty request', () => {
    expect(computeTotals([])).toEqual({ reimburseCents: 0, companyCents: 0, requestCents: 0 });
  });
});
