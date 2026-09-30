import { ApprovalRequiredError, SubmissionBlockedError, prepareApprovalRequest, prepareSubmission } from './submission';
import { messages } from '../domain/messages';
import { CERTIFICATION } from '../domain/purchaseRules';
import { ApprovalRecord, PurchaseLine } from '../domain/types';
import { file, line, quote, request } from '../testing/builders';

const now = new Date(2026, 9, 16, 9, 30);
const certified = { text: CERTIFICATION, email: 'jane.doe@example.com' };
const jane = { name: 'Jane Doe', email: 'jane.doe@example.com' };

// A vendor total of $1,000.00, which needs approval.
const big = (overrides: Partial<PurchaseLine> = {}) => line({ id: 'big', vendor: 'Acme Lab Supply', amountCents: 100000, ...overrides });
const approval = (cents: number, bought = false): ApprovalRecord => ({
  sent: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents, bought }],
  approved: [{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents, bought }]
});

describe('prepareSubmission: a request that needs no approval', () => {
  it('prepares the folder name, CSV, file copies and email', () => {
    const lines = [
      line({ id: 'a', rowNumber: 1, date: '2026-10-14', files: [file({ fileName: 'invoice.pdf' })], paidBy: 'company', amountCents: 12500 }),
      line({
        id: 'b',
        rowNumber: 2,
        date: '2026-10-12',
        vendor: 'Borealis',
        files: [file({ id: 'f2', fileName: 'slip.jpg', fingerprint: 'b' })],
        paidBy: 'employee',
        amountCents: 2500
      })
    ];
    const prepared = prepareSubmission(request(), lines, [], now, '', certified);
    expect(prepared.submission.type).toBe('package');
    // The earliest purchase date names the folder, so the year shows where it is filed (P-026).
    expect(prepared.submission.folderName).toBe('2026-10-12_Jane-Doe_Lab-supplies-for-the-Phase-1-assay_PR-0042');
    expect(prepared.csvName).toBe('PR-0042_Purchases.csv');
    expect(prepared.submission.packageFileNames).toEqual(['R01_invoice.pdf', 'R02_slip.jpg', 'PR-0042_Purchases.csv']);
    expect(prepared.submission.emailSubject).toBe('Purchase request submitted: Jane Doe, Lab supplies for the Phase 1 assay (PR-0042)');
    expect(prepared.submission.totalReimburseCents).toBe(2500);
    expect(prepared.submission.totalCompanyCents).toBe(12500);
    expect(prepared.submission.totalRequestCents).toBe(15000);
    expect(prepared.submission.purchaseDates).toBe('2026-10-12 to 2026-10-14');
    expect(prepared.submission.submittedOn).toBe('2026-10-16 09:30');
    expect(prepared.submission.receiptCount).toBe(2);
    expect(prepared.submission.boughtBeforeApproval).toBe(false);
    expect(prepared.submission.approvedBy).toBe('');
  });

  it('numbers a resubmission and names the folder it replaces', () => {
    const prepared = prepareSubmission(request({ submissionCount: 1 }), [line()], [], now, '2026-10-12_Jane-Doe_Lab_PR-0042', certified);
    expect(prepared.submission.submissionNumber).toBe(2);
    expect(prepared.submission.folderName.endsWith('_PR-0042_R2')).toBe(true);
    expect(prepared.csvName).toBe('PR-0042_R2_Purchases.csv');
    expect(prepared.submission.emailSubject).toContain('resubmitted');
    expect(prepared.submission.emailSummary).toContain('This replaces the earlier folder');
  });

  it('refuses a request with blocking problems', () => {
    expect(() => prepareSubmission(request({ businessPurpose: '' }), [line()], [], now, '', certified)).toThrow(SubmissionBlockedError);
    expect(() => prepareSubmission(request(), [line({ files: [] })], [], now, '', certified)).toThrow(SubmissionBlockedError);
  });

  it('writes the email summary as plain text, which the flow escapes (travel D-067)', () => {
    const prepared = prepareSubmission(request({ businessPurpose: '<b>urgent</b>' }), [line()], [], now, '', certified);
    expect(prepared.submission.emailSummary).toContain('Business purpose: <b>urgent</b>');
    expect(prepared.submission.emailSummary).toContain('Paid by Clarus: $125.00');
  });

  it('records the certification with the account, and refuses without it (P-010)', () => {
    const prepared = prepareSubmission(request(), [line()], [], now, '', certified);
    expect(prepared.submission.certificationText).toBe(CERTIFICATION);
    expect(prepared.submission.submitterEmail).toBe('jane.doe@example.com');
    expect(prepared.submission.emailSummary).toContain(CERTIFICATION);
    expect(prepared.csvContent).toContain('Jane Doe (jane.doe@example.com)');
    expect(() => prepareSubmission(request(), [line()], [], now, '', { text: '', email: 'jane.doe@example.com' })).toThrow(messages.certificationRequired);
    expect(() => prepareSubmission(request(), [line()], [], now, '', { text: 'Something else', email: 'jane.doe@example.com' })).toThrow();
    expect(() => prepareSubmission(request(), [line()], [], now, '', { text: CERTIFICATION, email: '' })).toThrow();
  });

  it('counts the rows without a receipt', () => {
    const prepared = prepareSubmission(request(), [line({ files: [], noReceiptReason: 'Lost' })], [], now, '', certified);
    expect(prepared.submission.rowsWithoutReceipt).toBe(1);
  });
});

describe('prepareSubmission: a request that needs approval (P-005, P-006)', () => {
  it('refuses to submit before the request has been approved', () => {
    expect(() => prepareSubmission(request(), [big({ files: [quote(), file()] })], [], now, '', certified)).toThrow(ApprovalRequiredError);
    expect(() => prepareSubmission(request(), [big({ files: [quote(), file()] })], [], now, '', certified)).toThrow(messages.approvalRequiredToSubmit);
  });

  it('refuses while the request awaits approval', () => {
    expect(() => prepareSubmission(request({ status: 'Awaiting approval' }), [big({ files: [file()] })], [], now, '', certified)).toThrow(
      ApprovalRequiredError
    );
  });

  it('submits once approved, and carries the approval, the flag and the approver into the package (P-009, P-017)', () => {
    const approved = request({
      status: 'Approved',
      approval: approval(100000, true),
      boughtBeforeApproval: true,
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvedOn: '2026-10-14 10:05'
    });
    const prepared = prepareSubmission(approved, [big({ files: [quote(), file({ fileName: 'invoice.pdf' })] })], [], now, '', certified);
    expect(prepared.submission.boughtBeforeApproval).toBe(true);
    expect(prepared.submission.approvedBy).toBe('Max Wamsley');
    expect(prepared.submission.quoteCount).toBe(1);
    expect(prepared.submission.packageFileNames).toEqual(['R01_invoice.pdf', 'Q01_quote.pdf', 'PR-0042_Purchases.csv']);
    expect(prepared.submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,000.00).');
    expect(prepared.csvContent).toContain('Approved,Yes,Max Wamsley,2026-10-14 10:05');
  });

  it('refuses once a vendor total has risen past what was approved (P-019)', () => {
    const approved = request({ status: 'Approved', approval: approval(100000), approvedBy: 'Max Wamsley', approvedOn: '2026-10-14 10:05' });
    expect(() => prepareSubmission(approved, [big({ amountCents: 110001, files: [file()] })], [], now, '', certified)).toThrow(ApprovalRequiredError);
    expect(() => prepareSubmission(approved, [big({ amountCents: 110000, files: [file()] })], [], now, '', certified)).not.toThrow();
  });

  it('still needs receipts after approval', () => {
    const approved = request({ status: 'Approved', approval: approval(100000), approvedBy: 'Max Wamsley', approvedOn: '2026-10-14 10:05' });
    expect(() => prepareSubmission(approved, [big({ files: [quote()] })], [], now, '', certified)).toThrow(SubmissionBlockedError);
  });
});

describe('prepareApprovalRequest (P-018)', () => {
  it('prepares an approval request: no files, an email for the approvers, and the vendor totals sent', () => {
    const prepared = prepareApprovalRequest(request(), [big({ date: '2026-10-20', files: [quote()] })], [], now, jane, 1);
    expect(prepared.submission.type).toBe('approval');
    expect(prepared.submission.submissionNumber).toBe(1);
    expect(prepared.submission.packageFileNames).toEqual([]);
    expect(prepared.submission.folderName).toBe('');
    expect(prepared.submission.certificationText).toBe('');
    expect(prepared.submission.quoteCount).toBe(1);
    expect(prepared.submission.emailSubject).toBe('Purchase approval needed: Jane Doe, Lab supplies for the Phase 1 assay (PR-0042)');
    expect(prepared.submission.emailSummary).toContain('- Acme Lab Supply: $1,000.00 (quote attached)');
    expect(prepared.sentGroups).toEqual([{ key: 'acme lab supply', vendor: 'Acme Lab Supply', cents: 100000, bought: false }]);
    expect(prepared.boughtBefore).toBe(false);
    expect(prepared.sentOn).toBe('2026-10-16 09:30');
  });

  it('flags a purchase that looks already bought, and still prepares it (P-017)', () => {
    const prepared = prepareApprovalRequest(request(), [big({ date: '2026-10-10', files: [file()], noQuoteReason: 'Already purchased' })], [], now, jane, 2);
    expect(prepared.boughtBefore).toBe(true);
    expect(prepared.sentGroups[0].bought).toBe(true);
    expect(prepared.submission.boughtBeforeApproval).toBe(true);
    expect(prepared.submission.emailSubject).toContain('needed again');
    expect(prepared.warnings.map((w) => w.message).join(' ')).toContain('Bought before approval');
    expect(prepared.submission.emailSummary).toContain('FLAG, bought before approval');
  });

  it('refuses without a quote or a reason (P-015), but does not need receipts or the certification (P-028)', () => {
    expect(() => prepareApprovalRequest(request(), [big({ files: [] })], [], now, jane, 1)).toThrow(SubmissionBlockedError);
    expect(() => prepareApprovalRequest(request(), [big({ files: [], noQuoteReason: 'Sole supplier' })], [], now, jane, 1)).not.toThrow();
  });

  it('refuses a request that needs no approval, and one that is already with the approver', () => {
    expect(() => prepareApprovalRequest(request(), [line()], [], now, jane, 1)).toThrow(messages.approvalNotNeeded);
    expect(() => prepareApprovalRequest(request({ status: 'Awaiting approval' }), [big({ files: [quote()] })], [], now, jane, 1)).toThrow();
  });

  it('can be sent again when a vendor total has risen past what was approved (P-019)', () => {
    const approved = request({ status: 'Approved', approval: approval(100000), approvedBy: 'Max Wamsley', approvedOn: '2026-10-14 10:05' });
    expect(() => prepareApprovalRequest(approved, [big({ amountCents: 120000, files: [quote()] })], [], now, jane, 2)).not.toThrow();
    // Still covered, so there is nothing to send.
    expect(() => prepareApprovalRequest(approved, [big({ amountCents: 105000, files: [quote()] })], [], now, jane, 2)).toThrow();
  });
});
