import { EMPTY_GUESS } from './receiptText';
import { marksAfterEdit, readingChanges, shouldReadReceipt, suggestedFieldsText, vendorMemoryChanges } from './suggestions';
import { line } from '../testing/builders';

const TODAY = '2026-09-29';
const empty = line({ date: '', vendor: '', category: '', amountCents: null, paymentType: 'companyCard' });
const guess = { date: '2026-09-14', amountCents: 4500, vendor: 'CITY CAB CO' };
// Earlier rows of the same employee, oldest first.
const history = [
  line({ id: 'h1', vendor: 'City Cab Co.', category: 'transportation', paymentType: 'companyCard' }),
  line({ id: 'h2', vendor: 'city cab co', category: 'transportation', paymentType: 'personal' })
];

describe('receipt suggestions (D-074, D-078)', () => {
  it('reads a receipt only when the date, amount or vendor is empty', () => {
    expect(shouldReadReceipt(empty)).toBe(true);
    expect(shouldReadReceipt(line({ vendor: '' }))).toBe(true);
    expect(shouldReadReceipt(line())).toBe(false);
    expect(shouldReadReceipt({ ...empty, sameReceiptAsRow: 1 })).toBe(false);
  });

  it('fills only empty fields and marks each one', () => {
    const changes = readingChanges({ ...empty, amountCents: 5000 }, guess, [], TODAY, false);
    expect(changes).toEqual({ date: '2026-09-14', vendor: 'CITY CAB CO', suggested: ['date', 'vendor'] });
  });

  it('never changes what the employee typed, and returns nothing when there is nothing to fill', () => {
    expect(readingChanges(line(), guess, history, TODAY, false)).toBeNull();
    expect(readingChanges(empty, EMPTY_GUESS, history, TODAY, false)).toBeNull();
  });

  it('ignores a date after today', () => {
    expect(readingChanges({ ...empty, vendor: 'X', amountCents: 1 }, { ...guess, date: '2026-10-01' }, [], TODAY, false)).toBeNull();
  });

  it("keeps the employee's own spelling of a known vendor, and adds their last category and Paid with, all marked", () => {
    const changes = readingChanges(empty, guess, history, TODAY, false);
    expect(changes).toEqual({
      date: '2026-09-14',
      amountCents: 4500,
      vendor: 'city cab co',
      category: 'transportation',
      paymentType: 'personal',
      suggested: ['date', 'vendor', 'category', 'amount', 'paymentType']
    });
  });

  it('leaves Paid with alone once the employee has chosen it on the row', () => {
    const changes = readingChanges(empty, guess, history, TODAY, true);
    expect(changes?.paymentType).toBeUndefined();
    expect(changes?.suggested).toEqual(['date', 'vendor', 'category', 'amount']);
  });

  it('after a typed vendor, fills the category unmarked (D-057) and marks a changed Paid with', () => {
    const typed = { ...empty, vendor: 'City Cab Co.' };
    expect(vendorMemoryChanges('City Cab Co.', typed, history, { paidWithChosen: false, vendorSuggested: false })).toEqual({
      category: 'transportation',
      paymentType: 'personal',
      suggested: ['paymentType']
    });
    expect(vendorMemoryChanges('City Cab Co.', { ...typed, paymentType: 'personal' }, history, { paidWithChosen: false, vendorSuggested: false })).toEqual({
      category: 'transportation'
    });
    expect(vendorMemoryChanges('New Vendor', typed, history, { paidWithChosen: false, vendorSuggested: false })).toEqual({});
  });

  it('does not learn from values that were never confirmed', () => {
    const unconfirmed = [...history, line({ id: 'h3', vendor: 'City Cab Co', paymentType: 'paidByClarus', suggested: ['paymentType'] })];
    expect(vendorMemoryChanges('City Cab Co', empty, unconfirmed, { paidWithChosen: false, vendorSuggested: false }).paymentType).toBe('personal');
  });

  it('drops the mark of each field the employee edits', () => {
    const marked = line({ suggested: ['date', 'vendor', 'amount'] });
    expect(marksAfterEdit(marked, ['amountCents'])).toEqual(['date', 'vendor']);
    expect(marksAfterEdit(marked, ['description'])).toBeUndefined();
  });

  it('names the suggested fields in grid order', () => {
    expect(suggestedFieldsText(['amount', 'date'])).toBe('date and amount');
    expect(suggestedFieldsText(['paymentType', 'vendor', 'date'])).toBe('date, vendor and paid with');
    expect(suggestedFieldsText(['vendor'])).toBe('vendor');
  });
});
