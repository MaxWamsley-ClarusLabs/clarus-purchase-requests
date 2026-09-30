import { computeTotals } from './totals';
import { line } from '../testing/builders';

describe('computeTotals', () => {
  it('splits reimbursable and company-paid rows, in cents', () => {
    const totals = computeTotals([
      line({ id: 'a', amountCents: 10010, paymentType: 'personal' }),
      line({ id: 'b', amountCents: 20020, paymentType: 'companyCard' }),
      line({ id: 'c', amountCents: 3, paymentType: 'paidByClarus' })
    ]);
    expect(totals).toEqual({ reimburseCents: 10010, companyCents: 20023, tripCents: 30033 });
  });

  it('counts rows without a payment type in the trip total only, and skips rows without an amount', () => {
    const totals = computeTotals([line({ id: 'a', amountCents: 500, paymentType: '' }), line({ id: 'b', amountCents: null })]);
    expect(totals).toEqual({ reimburseCents: 0, companyCents: 0, tripCents: 500 });
  });
});
