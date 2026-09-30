import { blockingIssues, approvalStateOf, validateRequest, validationStage } from './validation';
import { LineRef } from './duplicates';
import { messages } from './messages';
import { ApprovalRecord, PurchaseLine, PurchaseRequest } from './types';
import { file, line, quote, request } from '../testing/builders';

// A fixed "today" so results never depend on when the tests run.
const TODAY = '2026-10-20';
const check = (r: PurchaseRequest, lines: PurchaseLine[], others: LineRef[] = []) => validateRequest(r, lines, others, TODAY);

// A vendor total of $600, so the request needs approval.
const big = (overrides: Partial<PurchaseLine> = {}) => line({ id: 'big', amountCents: 60000, vendor: 'Acme Lab Supply', ...overrides });
const approved = (cents: number): ApprovalRecord => ({
  sent: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents, bought: false }],
  approved: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents, bought: false }]
});

describe('validateRequest: a request with no approval needed', () => {
  it('passes a complete request', () => {
    expect(check(request(), [line()])).toEqual([]);
  });

  it('blocks missing request details', () => {
    const issues = check(request({ businessPurpose: ' ', department: '' }), []);
    expect(blockingIssues(issues).map((i) => i.field)).toEqual(['businessPurpose', 'department', 'rows']);
  });

  it('blocks missing row fields and zero amounts', () => {
    const issues = check(request(), [line({ date: '', vendor: '', description: ' ', category: '', amountCents: 0, paidBy: '' })]);
    expect(blockingIssues(issues).map((i) => i.field)).toEqual(['date', 'vendor', 'description', 'category', 'amount', 'paidBy']);
  });

  it('needs a description of the category for Other, and nothing extra for the other categories', () => {
    const issues = check(request(), [
      line({ id: 'a', rowNumber: 1, category: 'other', categoryOther: '', files: [file({ fingerprint: 'x1' })] }),
      line({ id: 'b', rowNumber: 2, category: 'other', categoryOther: 'Lab safety audit', files: [file({ fingerprint: 'x2' })], vendor: 'Other Co' }),
      line({ id: 'c', rowNumber: 3, category: 'office', files: [file({ fingerprint: 'x3' })], vendor: 'Third Co' })
    ]);
    expect(blockingIssues(issues).map((i) => [i.rowNumber, i.field])).toEqual([[1, 'categoryOther']]);
  });

  it('blocks a row with values the app suggested until the employee confirms them (travel D-078)', () => {
    const issues = check(request(), [line({ suggested: ['amount', 'date'] })]);
    expect(blockingIssues(issues)).toEqual([
      expect.objectContaining({ field: 'suggested', rowNumber: 1, message: messages.suggestionsNotConfirmed('date and amount') })
    ]);
  });

  it('needs a receipt or a reason, because submitting is the next action', () => {
    expect(validationStage(request(), [line()])).toBe('submit');
    const noReceipt = line({ files: [] });
    expect(blockingIssues(check(request(), [noReceipt])).map((i) => i.message)).toEqual([messages.receiptOrReason]);
    expect(check(request(), [line({ files: [], noReceiptReason: 'Receipt lost' })])).toEqual([]);
  });

  it('a quote is not a receipt', () => {
    expect(blockingIssues(check(request(), [line({ files: [quote()] })])).map((i) => i.field)).toEqual(['receipt']);
  });

  it("accepts a row that shares another row's receipt, and blocks a broken pointer", () => {
    const holder = line({ id: 'a', rowNumber: 1 });
    const sharer = line({ id: 'b', rowNumber: 2, files: [], sameReceiptAsRow: 1, vendor: 'Hotel', amountCents: 2000 });
    expect(check(request(), [holder, sharer])).toEqual([]);
    const broken = line({ id: 'c', rowNumber: 3, files: [], sameReceiptAsRow: 7, vendor: 'Taxi', amountCents: 2000 });
    expect(blockingIssues(check(request(), [holder, broken])).map((i) => i.message)).toEqual([messages.sameReceiptBroken(7)]);
  });

  it('does not warn about old purchases: only a request that needs approval can be "bought before approval"', () => {
    expect(check(request(), [line({ date: '2026-01-02' })])).toEqual([]);
  });

  it("warns about the same file or the same entry, in this request and in the employee's other requests", () => {
    const a = line({ id: 'a', rowNumber: 1, files: [file({ fingerprint: 'same' })] });
    const b = line({ id: 'b', rowNumber: 2, files: [file({ fingerprint: 'same' })], vendor: 'Other vendor' });
    const inRequest = check(request(), [a, b]);
    expect(inRequest.filter((i) => i.severity === 'warning').map((i) => i.message)).toEqual([
      messages.duplicateFileInRequest(2),
      messages.duplicateFileInRequest(1)
    ]);

    const elsewhere = {
      line: line({ id: 'z', rowNumber: 4, files: [file({ fingerprint: 'other' })] }),
      requestNumber: 'PR-0031',
      ownerEmail: 'jane.doe@example.com'
    };
    const c = line({ id: 'c', rowNumber: 1, files: [file({ fingerprint: 'new' })] });
    const cross = check(request(), [c], [elsewhere]);
    expect(cross.map((i) => i.message)).toEqual([messages.duplicateEntryElsewhere('PR-0031', 4)]);
    expect(blockingIssues(cross)).toEqual([]);
  });

  it('does not treat a quote file used on two rows as a duplicate', () => {
    const a = line({ id: 'a', rowNumber: 1, files: [file({ fingerprint: 'r1' }), quote({ fingerprint: 'sameQuote' })] });
    const b = line({ id: 'b', rowNumber: 2, vendor: 'Second', files: [file({ id: 'f2', fingerprint: 'r2' }), quote({ id: 'q2', fingerprint: 'sameQuote' })] });
    expect(check(request(), [a, b])).toEqual([]);
  });
});

describe('validateRequest: a vendor total of $500 or more, before it is approved', () => {
  it('is checked for sending for approval, not for submitting', () => {
    expect(approvalStateOf(request(), [big()])).toBe('needed');
    expect(validationStage(request(), [big()])).toBe('approval');
  });

  it('counts the vendor across lines, so splitting a purchase does not avoid approval (P-016)', () => {
    const split = [
      big({ id: 'a', rowNumber: 1, amountCents: 20000 }),
      big({ id: 'b', rowNumber: 2, amountCents: 20000 }),
      big({ id: 'c', rowNumber: 3, amountCents: 20000 })
    ];
    expect(validationStage(request(), split)).toBe('approval');
    // Each line is under $500; the vendor total is $600.00.
    expect(split.every((l) => (l.amountCents ?? 0) < 50000)).toBe(true);
  });

  it('does not need a receipt yet', () => {
    const issues = check(request(), [big({ files: [quote()] })]);
    expect(blockingIssues(issues)).toEqual([]);
  });

  it("needs a quote or a no-quote reason, shown on the vendor's first row (P-015)", () => {
    const issues = check(request(), [big({ files: [] })]);
    expect(blockingIssues(issues)).toEqual([
      expect.objectContaining({ field: 'quote', rowNumber: 1, message: messages.quoteOrReason('Acme Lab Supply', '$600.00') })
    ]);
    expect(blockingIssues(check(request(), [big({ files: [], noQuoteReason: 'Sole supplier' })]))).toEqual([]);
    expect(blockingIssues(check(request(), [big({ files: [quote()] })]))).toEqual([]);
  });

  it('does not accept a receipt as the quote', () => {
    expect(blockingIssues(check(request(), [big({ files: [file()] })])).map((i) => i.field)).toEqual(['quote']);
  });

  it('warns that a purchase dated before today, or with a receipt, will be flagged bought before approval (P-017)', () => {
    const dated = check(request(), [big({ date: '2026-10-10', files: [quote()] })]);
    expect(dated.filter((i) => i.severity === 'warning').map((i) => i.message)).toEqual([messages.boughtBeforeWarning('Acme Lab Supply', '$600.00')]);
    const withReceipt = check(request(), [big({ date: '2026-10-25', files: [file(), quote()] })]);
    expect(withReceipt.filter((i) => i.severity === 'warning')).toHaveLength(1);
    // Planned for today or later, with only a quote: not flagged.
    expect(check(request(), [big({ date: '2026-10-20', files: [quote()] })])).toEqual([]);
  });
});

describe('validateRequest: after approval', () => {
  it('is checked for submitting: receipts are needed, the quote is not checked again', () => {
    const r = request({ status: 'Approved', approval: approved(60000) });
    expect(validationStage(r, [big()])).toBe('submit');
    expect(check(r, [big({ files: [file()] })])).toEqual([]);
    expect(blockingIssues(check(r, [big({ files: [quote()] })])).map((i) => i.field)).toEqual(['receipt']);
  });

  it('allows a small rise in a vendor total, but checks for approval again past the allowance (P-019)', () => {
    const r = request({ status: 'Approved', approval: approved(60000) });
    expect(approvalStateOf(r, [big({ amountCents: 66000 })])).toBe('approved');
    expect(approvalStateOf(r, [big({ amountCents: 66001 })])).toBe('changed');
    expect(validationStage(r, [big({ amountCents: 66001 })])).toBe('approval');
  });

  it('checks the quote rule again for a new vendor total of $500 or more', () => {
    const r = request({ status: 'Approved', approval: approved(60000) });
    const lines = [
      big({ files: [quote(), file()] }),
      line({ id: 'new', rowNumber: 2, vendor: 'Borealis', amountCents: 55000, files: [file({ id: 'f2', fingerprint: 'b' })] })
    ];
    expect(validationStage(r, lines)).toBe('approval');
    expect(blockingIssues(check(r, lines)).map((i) => [i.rowNumber, i.field])).toEqual([[2, 'quote']]);
  });

  it('is checked as awaiting approval while it is with the approver', () => {
    const r = request({ status: 'Awaiting approval' });
    expect(approvalStateOf(r, [big()])).toBe('pending');
    expect(validationStage(r, [big()])).toBe('approval');
  });
});
