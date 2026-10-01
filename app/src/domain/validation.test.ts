import { approvalGroupsToSend, blockingIssues, approvalStateOf, looksBoughtNow, validateRequest, validationStage } from './validation';
import { LineRef } from './duplicates';
import { messages } from './messages';
import { MAX_AMOUNT_CENTS, formatCents } from './money';
import { vendorKey } from './purchaseRules';
import { ApprovalRecord, PurchaseLine, PurchaseRequest } from './types';
import { file, line, quote, request } from '../testing/builders';

// A fixed "today" so results never depend on when the tests run.
const TODAY = '2026-10-20';
const check = (r: PurchaseRequest, lines: PurchaseLine[], others: LineRef[] = []) => validateRequest(r, lines, others, TODAY);

// A vendor total of $600, so the request needs approval.
const big = (overrides: Partial<PurchaseLine> = {}) => line({ id: 'big', amountCents: 60000, vendor: 'Acme Lab Supply', ...overrides });
const ACME = vendorKey('Acme Lab Supply');
const approved = (cents: number): ApprovalRecord => ({
  sent: [{ key: ACME, vendor: 'Acme Lab Supply', cents, bought: false }],
  approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents, bought: false }],
  earlier: []
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

  it('tells a missing date from one that is not a date between 2000 and 2099', () => {
    const message = (date: string) => blockingIssues(check(request(), [line({ date })])).map((i) => [i.field, i.message]);
    expect(message('')).toEqual([['date', messages.dateRequired]]);
    expect(message('0026-10-14')).toEqual([['date', messages.dateInvalid]]);
    expect(message('2026-02-30')).toEqual([['date', messages.dateInvalid]]);
    expect(message('2026-10-14')).toEqual([]);
    expect(messages.dateInvalid).toBe('Enter a date between 2000 and 2099, like 2026-10-14.');
  });

  it('tells an amount that is missing or not an amount from one that is zero or less', () => {
    const message = (amountCents: number | null) => blockingIssues(check(request(), [line({ amountCents })])).map((i) => [i.field, i.message]);
    expect(message(null)).toEqual([['amount', messages.amountRequired]]);
    expect(message(0)).toEqual([['amount', messages.amountNotPositive]]);
    expect(message(-100)).toEqual([['amount', messages.amountNotPositive]]);
    // The largest amount accepted is said too, from the same number the amount check uses (P-035).
    expect(messages.amountRequired).toBe('Enter an amount like 45.10: digits, at most two decimals, up to $10,000,000.00.');
    expect(messages.amountRequired).toContain(formatCents(MAX_AMOUNT_CENTS));
  });

  it('reads a vendor made only of characters that show nothing as no vendor, which cannot be sent or submitted (P-016)', () => {
    for (const vendor of ['​', 'ㅤ', ' ­⁠ ']) {
      expect(blockingIssues(check(request(), [line({ vendor })])).map((i) => [i.field, i.message])).toEqual([['vendor', messages.vendorRequired]]);
    }
    // A name with no letter or digit that shows something is still a vendor.
    expect(check(request(), [line({ vendor: '-' })])).toEqual([]);
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

  it('matches vendors for duplicates as the thresholds do (P-016)', () => {
    const a = line({ id: 'a', rowNumber: 1, vendor: 'Digi-Key', files: [file({ fingerprint: 'r1' })] });
    const b = line({ id: 'b', rowNumber: 2, vendor: 'DIGIKEY', files: [file({ id: 'f2', fingerprint: 'r2' })] });
    expect(check(request(), [a, b]).map((i) => i.message)).toEqual([messages.duplicateEntryInRequest(2), messages.duplicateEntryInRequest(1)]);
  });

  it("compares a receipt a row holds itself even when it also points at another row's receipt", () => {
    const a = line({ id: 'a', rowNumber: 1, files: [file({ fingerprint: 'shared' })] });
    const b = line({ id: 'b', rowNumber: 2, vendor: 'Other vendor', files: [file({ id: 'f2', fingerprint: 'own' })], sameReceiptAsRow: 1 });
    const elsewhere = {
      line: line({ id: 'z', rowNumber: 4, vendor: 'Third', files: [file({ fingerprint: 'own' })] }),
      requestNumber: 'PR-0031',
      ownerEmail: ''
    };
    const warnings = check(request(), [a, b], [elsewhere]).filter((i) => i.severity === 'warning');
    expect(warnings.map((i) => [i.rowNumber, i.message])).toEqual([[2, messages.duplicateFileElsewhere('PR-0031', 4)]]);
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

  it('says a vendor total keeps the flag of an earlier round when nothing in it looks bought now (P-017)', () => {
    // Sent dated before the day it was sent, so flagged; returned; the date was then moved to after today.
    const returned = request({
      status: 'Returned',
      returnStage: 'approval',
      approval: { sent: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 60000, bought: true }], approved: [], earlier: [] }
    });
    const warnings = (lines: PurchaseLine[]) =>
      check(returned, lines)
        .filter((i) => i.severity === 'warning')
        .map((i) => [i.rowNumber, i.field, i.message]);
    expect(warnings([big({ date: '2026-10-25', files: [quote()] })])).toEqual([[1, 'date', messages.boughtBeforeEarlierWarning('Acme Lab Supply', '$600.00')]]);
    expect(messages.boughtBeforeEarlierWarning('Acme Lab Supply', '$600.00')).toBe(
      'Acme Lab Supply totals $600.00 and was flagged as bought before approval when it was sent before. It can still be sent for approval.'
    );
    // Still dated before today, or with a receipt: it looks bought now, so the usual warning.
    expect(warnings([big({ date: '2026-10-10', files: [quote()] })])).toEqual([[1, 'date', messages.boughtBeforeWarning('Acme Lab Supply', '$600.00')]]);
    expect(warnings([big({ date: '2026-10-25', files: [quote(), file()] })])).toEqual([
      [1, 'date', messages.boughtBeforeWarning('Acme Lab Supply', '$600.00')]
    ]);
  });

  it('tells whether a vendor total looks bought now: a row dated before the day, or with a receipt (P-017)', () => {
    const lines = [big({ id: 'a', rowNumber: 1, date: '2026-10-25', files: [quote()] }), big({ id: 'b', rowNumber: 2, date: '2026-10-25', files: [] })];
    expect(looksBoughtNow(lines, ACME, TODAY)).toBe(false);
    expect(looksBoughtNow([lines[0], { ...lines[1], date: '2026-10-19' }], ACME, TODAY)).toBe(true);
    expect(looksBoughtNow([lines[0], { ...lines[1], files: [file()] }], ACME, TODAY)).toBe(true);
    // A row that uses another row's receipt has one too.
    const holder = line({ id: 'h', rowNumber: 3, vendor: 'Other Co', amountCents: 1000 });
    expect(looksBoughtNow([lines[0], { ...lines[1], sameReceiptAsRow: 3 }, holder], ACME, TODAY)).toBe(true);
    expect(looksBoughtNow(lines, 'no-such-vendor', TODAY)).toBe(false);
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

  it('warns about bought before approval only for what an earlier approval does not cover (P-017)', () => {
    const r = request({ status: 'Approved', approval: approved(60000) });
    const lines = [
      big({ files: [quote(), file()] }),
      line({
        id: 'new',
        rowNumber: 2,
        vendor: 'Borealis',
        amountCents: 55000,
        files: [quote({ id: 'q2', fingerprint: 'q2' }), file({ id: 'f2', fingerprint: 'b' })]
      })
    ];
    const warnings = check(r, lines).filter((i) => i.severity === 'warning');
    expect(warnings.map((i) => [i.rowNumber, i.message])).toEqual([[2, messages.boughtBeforeWarning('Borealis', '$550.00')]]);
    expect(approvalGroupsToSend(r, lines, TODAY).map((g) => [g.vendor, g.bought])).toEqual([
      ['Acme Lab Supply', false],
      ['Borealis', true]
    ]);
  });

  it('is checked as awaiting approval while it is with the approver', () => {
    const r = request({ status: 'Awaiting approval' });
    expect(approvalStateOf(r, [big()])).toBe('pending');
    expect(validationStage(r, [big()])).toBe('approval');
  });
});

describe('validateRequest: a request the approver buys (P-037, P-039)', () => {
  const approverRequest = (overrides: Parameters<typeof request>[0] = {}) => request({ buyer: 'approver', ...overrides });
  const withLink = (overrides: Partial<PurchaseLine> = {}) =>
    line({ id: 'a', paidBy: '', files: [], itemLink: 'https://www.example.com/item/42', ...overrides });

  it('is checked for sending to the approver whatever it costs, and does not ask who paid or for a receipt', () => {
    const r = approverRequest();
    expect(approvalStateOf(r, [withLink()])).toBe('needed');
    expect(validationStage(r, [withLink()])).toBe('approval');
    expect(check(r, [withLink()])).toEqual([]);
  });

  it('asks for the item link, or a reason there is no web page, before the request is sent', () => {
    const r = approverRequest();
    expect(blockingIssues(check(r, [withLink({ itemLink: '' })])).map((i) => [i.field, i.message])).toEqual([['link', messages.linkOrReason]]);
    expect(check(r, [withLink({ itemLink: '', noLinkReason: 'Not sold online' })])).toEqual([]);
    expect(check(r, [withLink({ itemLink: '   ', noLinkReason: '  ' })]).map((i) => i.field)).toEqual(['link']);
  });

  it('does not ask for the link of a request the employee buys, but refuses an address that is not one', () => {
    const own = request();
    expect(check(own, [line({ itemLink: '' })])).toEqual([]);
    expect(blockingIssues(check(own, [line({ itemLink: 'javascript:alert(1)' })])).map((i) => [i.field, i.message])).toEqual([
      ['link', messages.linkNotAddress]
    ]);
  });

  it('refuses a link that is not a web address, or is too long, even when a reason is given', () => {
    const r = approverRequest();
    expect(blockingIssues(check(r, [withLink({ itemLink: 'amazon', noLinkReason: 'x' })])).map((i) => i.message)).toEqual([messages.linkNotAddress]);
    expect(blockingIssues(check(r, [withLink({ itemLink: `https://example.com/${'a'.repeat(2100)}` })])).map((i) => i.message)).toEqual([
      messages.linkTooLong(2000)
    ]);
  });

  it('checks the receipt when the approver marks it purchased, and no longer asks for the link', () => {
    const approvedRecord: ApprovalRecord = { sent: [], approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 12500, bought: false }], earlier: [] };
    const r = approverRequest({ status: 'Approved', approval: approvedRecord });
    expect(validationStage(r, [withLink()])).toBe('submit');
    // No receipt yet, and the link is no longer needed.
    expect(blockingIssues(check(r, [withLink({ itemLink: '' })])).map((i) => [i.field, i.message])).toEqual([['receipt', messages.receiptOrReason]]);
    expect(check(r, [withLink({ files: [file()] })])).toEqual([]);
  });

  it('never warns that a purchase looks bought before approval', () => {
    const r = approverRequest();
    expect(check(r, [withLink({ date: '2026-09-01', files: [file()] })])).toEqual([]);
    expect(approvalGroupsToSend(r, [withLink({ date: '2026-09-01', files: [file()] })], TODAY).map((g) => g.bought)).toEqual([false]);
  });
});
