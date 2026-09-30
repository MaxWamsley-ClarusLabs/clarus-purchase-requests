import { blockingIssues, validateReport } from './validation';
import { LineRef } from './duplicates';
import { messages } from './messages';
import { ExpenseLine, TravelReport } from './types';
import { line, receipt, report } from '../testing/builders';

// A fixed "today" so results never depend on when the tests run.
const AS_OF = '2026-10-20';
const check = (r: TravelReport, lines: ExpenseLine[], others: LineRef[] = []) => validateReport(r, lines, others, AS_OF);

describe('validateReport', () => {
  it('passes a complete report', () => {
    expect(check(report(), [line()])).toEqual([]);
  });

  it('blocks missing report details, including the trip purpose', () => {
    const issues = check(report({ tripName: ' ', destination: '', businessPurpose: '', tripPurpose: '', tripStart: '', tripEnd: '' }), []);
    const fields = blockingIssues(issues).map((i) => i.field);
    expect(fields).toEqual(['tripName', 'destination', 'businessPurpose', 'tripPurpose', 'tripStart', 'tripEnd', 'rows']);
  });

  it('allows "Not sure" as the trip purpose', () => {
    expect(check(report({ tripPurpose: 'notSure' }), [line()])).toEqual([]);
  });

  it('blocks an end date before the start date', () => {
    const issues = check(report({ tripStart: '2026-10-15', tripEnd: '2026-10-12' }), [line({ date: '2026-10-13' })]);
    expect(issues.map((i) => i.message)).toContain(messages.tripEndBeforeStart);
  });

  it('blocks missing row fields and zero amounts', () => {
    const issues = check(report(), [line({ date: '', vendor: '', category: '', amountCents: 0, paymentType: '' })]);
    expect(blockingIssues(issues).map((i) => i.field)).toEqual(['date', 'vendor', 'category', 'amount', 'paymentType']);
  });

  it('blocks a row with values the app suggested until the employee confirms them (D-078)', () => {
    const issues = check(report(), [line({ suggested: ['amount', 'date'] })]);
    expect(blockingIssues(issues)).toEqual([
      expect.objectContaining({ field: 'suggested', rowNumber: 1, message: messages.suggestionsNotConfirmed('date and amount') })
    ]);
  });

  it('needs a description for Other travel, and nothing extra for business meals (D-056)', () => {
    const issues = check(report(), [
      line({ id: 'a', rowNumber: 1, category: 'otherTravel', receipts: [receipt({ fingerprint: 'x1' })] }),
      line({ id: 'b', rowNumber: 2, category: 'businessMeal', receipts: [receipt({ fingerprint: 'x2' })], vendor: 'Other' })
    ]);
    expect(blockingIssues(issues).map((i) => [i.rowNumber, i.field])).toEqual([[1, 'description']]);
  });

  it('needs a receipt or a reason', () => {
    const noReceipt = line({ receipts: [] });
    expect(blockingIssues(check(report(), [noReceipt])).map((i) => i.message)).toEqual([messages.receiptOrReason]);
    expect(check(report(), [line({ receipts: [], noReceiptReason: 'Lost at the airport' })])).toEqual([]);
  });

  it("accepts a row that shares another row's receipt, and blocks a broken pointer", () => {
    const holder = line({ id: 'a', rowNumber: 1 });
    const sharer = line({ id: 'b', rowNumber: 2, receipts: [], sameReceiptAsRow: 1, category: 'meals', amountCents: 2000, vendor: 'Hotel restaurant' });
    expect(check(report(), [holder, sharer])).toEqual([]);
    const broken = line({ id: 'c', rowNumber: 3, receipts: [], sameReceiptAsRow: 7, vendor: 'Taxi', amountCents: 2000 });
    expect(blockingIssues(check(report(), [holder, broken])).map((i) => i.message)).toEqual([messages.sameReceiptBroken(7)]);
  });

  it('warns, without blocking, about in-trip costs dated outside the trip', () => {
    const issues = check(report(), [line({ date: '2026-09-30', category: 'lodging' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', field: 'date', message: messages.dateOutsideTrip });
  });

  it('does not warn about airfare or registration paid before the trip', () => {
    expect(check(report(), [line({ id: 'a', date: '2026-08-20', category: 'airfare' })])).toEqual([]);
    expect(check(report(), [line({ id: 'b', date: '2026-08-10', category: 'registration', vendor: 'Conf' })])).toEqual([]);
  });

  it("warns about the same file or the same entry, in this report and in the employee's other reports", () => {
    const a = line({ id: 'a', rowNumber: 1, receipts: [receipt({ fingerprint: 'same' })] });
    const b = line({ id: 'b', rowNumber: 2, receipts: [receipt({ fingerprint: 'same' })], vendor: 'Other vendor' });
    const inReport = check(report(), [a, b]);
    expect(inReport.filter((i) => i.severity === 'warning').map((i) => i.message)).toEqual([
      messages.duplicateFileInReport(2),
      messages.duplicateFileInReport(1)
    ]);

    const elsewhere = {
      line: line({ id: 'z', rowNumber: 4, receipts: [receipt({ fingerprint: 'other' })] }),
      reportNumber: 'TR-0031',
      ownerEmail: 'jane.doe@example.com'
    };
    const c = line({ id: 'c', rowNumber: 1, receipts: [receipt({ fingerprint: 'new' })] });
    const cross = check(report(), [c], [elsewhere]);
    expect(cross.map((i) => i.message)).toEqual([messages.duplicateEntryElsewhere('TR-0031', 4)]);
    expect(blockingIssues(cross)).toEqual([]);
  });

  it('warns, without blocking, when a report is submitted more than 30 days after the trip (D-065)', () => {
    // The sample trip ends 2026-10-15.
    expect(validateReport(report(), [line()], [], '2026-11-14')).toEqual([]);
    const late = validateReport(report(), [line()], [], '2026-11-15');
    expect(late).toEqual([{ severity: 'warning', scope: 'report', field: 'tripEnd', message: messages.lateSubmission(31) }]);
  });
});
