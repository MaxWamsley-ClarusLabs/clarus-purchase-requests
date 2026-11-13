import { ApprovalRequiredError, SubmissionBlockedError, prepareApprovalRequest, prepareSubmission } from './submission';
import { messages } from '../domain/messages';
import { CERTIFICATION, groupsForApproved, vendorKey } from '../domain/purchaseRules';
import { ApprovalRecord, PurchaseLine } from '../domain/types';
import { file, line, quote, request } from '../testing/builders';

const now = new Date(2026, 9, 16, 9, 30);
const certified = { text: CERTIFICATION, email: 'jane.doe@example.com' };
const jane = { name: 'Jane Doe', email: 'jane.doe@example.com' };

// A vendor total of $1,000.00, which needs approval.
const big = (overrides: Partial<PurchaseLine> = {}) => line({ id: 'big', vendor: 'Acme Lab Supply', amountCents: 100000, ...overrides });
const ACME = vendorKey('Acme Lab Supply');
const approval = (cents: number, bought = false): ApprovalRecord => ({
  sent: [{ key: ACME, vendor: 'Acme Lab Supply', cents, bought }],
  approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents, bought }],
  earlier: []
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
    expect(prepared.sentGroups).toEqual([{ key: 'acmelabsupply', vendor: 'Acme Lab Supply', cents: 100000, bought: false }]);
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

  it('refuses a request that needs no approval, one that is already with the approver, and one still covered by its approval, saying which', () => {
    expect(() => prepareApprovalRequest(request(), [line()], [], now, jane, 1)).toThrow(messages.approvalNotNeeded);
    expect(() => prepareApprovalRequest(request({ status: 'Awaiting approval' }), [big({ files: [quote()] })], [], now, jane, 1)).toThrow(
      messages.alreadyWithApprover
    );
    const approved = request({ status: 'Approved', approval: approval(100000), approvedBy: 'Max Wamsley', approvedOn: '2026-10-14 10:05' });
    expect(() => prepareApprovalRequest(approved, [big({ files: [quote(), file()] })], [], now, jane, 2)).toThrow(messages.alreadyApproved);
    expect(messages.alreadyApproved).not.toContain('with the approver');
  });

  it('can be sent again when a vendor total has risen past what was approved (P-019)', () => {
    const approved = request({ status: 'Approved', approval: approval(100000), approvedBy: 'Max Wamsley', approvedOn: '2026-10-14 10:05' });
    expect(() => prepareApprovalRequest(approved, [big({ amountCents: 120000, files: [quote()] })], [], now, jane, 2)).not.toThrow();
    // Still covered, so there is nothing to send.
    expect(() => prepareApprovalRequest(approved, [big({ amountCents: 105000, files: [quote()] })], [], now, jane, 2)).toThrow();
  });

  it('keeps the bought-before-approval flag of an earlier round, even after the date is moved to the future (P-017)', () => {
    const first = prepareApprovalRequest(request(), [big({ date: '2026-10-10', files: [quote()] })], [], now, jane, 1);
    expect(first.sentGroups[0].bought).toBe(true);
    // Returned at the approval step, then the date is changed and the request is sent again.
    const returned = request({
      status: 'Returned',
      returnStage: 'approval',
      approvalRounds: 1,
      approval: { sent: first.sentGroups, approved: [], earlier: [] }
    });
    const again = prepareApprovalRequest(returned, [big({ date: '2026-12-01', files: [quote()] })], [], new Date(2026, 9, 17, 9, 0), jane, 2);
    expect(again.sentGroups).toEqual([{ key: ACME, vendor: 'Acme Lab Supply', cents: 100000, bought: true }]);
    expect(again.boughtBefore).toBe(true);
    expect(again.submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,000.00).');
    expect(again.submission.emailSummary).toContain('(round 2, sent again)');
  });

  it('flags only the vendor total that rose past its approval, and the approval email, the CSV and the submission email agree', () => {
    // Round 1 approved Acme at $1,000.00 and Borealis at $800.00, each with a quote. Both were bought afterwards.
    const groups = [
      { key: ACME, vendor: 'Acme Lab Supply', cents: 100000, bought: false },
      { key: vendorKey('Borealis Optics'), vendor: 'Borealis Optics', cents: 80000, bought: false }
    ];
    const roundOne = request({
      status: 'Approved',
      approvalRounds: 1,
      approval: { sent: groups, approved: groups, earlier: [] },
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvedOn: '2026-10-14 10:05'
    });
    const bought = [
      big({
        id: 'a',
        rowNumber: 1,
        date: '2026-10-15',
        amountCents: 115000,
        files: [quote(), file({ id: 'ra', fileName: 'acme-invoice.pdf', fingerprint: 'ra' })]
      }),
      line({
        id: 'b',
        rowNumber: 2,
        vendor: 'Borealis Optics',
        date: '2026-10-15',
        amountCents: 80000,
        files: [quote({ id: 'qb', fingerprint: 'qb' }), file({ id: 'rb', fileName: 'borealis-invoice.pdf', fingerprint: 'rb' })]
      })
    ];
    // Acme is now $1,150.00, more than 10% above what was approved, so the request goes for approval again.
    const roundTwo = prepareApprovalRequest(roundOne, bought, [], new Date(2026, 9, 20, 9, 0), jane, 2);
    expect(roundTwo.sentGroups).toEqual([
      { key: ACME, vendor: 'Acme Lab Supply', cents: 115000, bought: true },
      { key: vendorKey('Borealis Optics'), vendor: 'Borealis Optics', cents: 80000, bought: false }
    ]);
    expect(roundTwo.submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,150.00).');
    expect(roundTwo.submission.emailSummary).not.toMatch(/FLAG.*Borealis/);

    // The approver approves round 2, and the employee submits.
    const approvedAgain = request({
      ...roundOne,
      approvalRounds: 2,
      boughtBeforeApproval: roundTwo.boughtBefore,
      approval: { sent: roundTwo.sentGroups, approved: groupsForApproved(bought, roundTwo.sentGroups), earlier: groups },
      approvedOn: '2026-10-21 10:00'
    });
    const package_ = prepareSubmission(approvedAgain, bought, [], new Date(2026, 9, 22, 9, 0), '', certified);
    expect(package_.submission.boughtBeforeApproval).toBe(true);
    expect(package_.submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,150.00).');
    expect(package_.submission.emailSummary).not.toMatch(/FLAG.*Borealis/);
    const rows = package_.csvContent.replace(/^\uFEFF/, '').split('\r\n');
    expect(rows[1]).toContain('Acme Lab Supply');
    expect(rows[1]).toContain('Approved,Yes,Max Wamsley');
    expect(rows[2]).toContain('Borealis Optics');
    expect(rows[2]).toContain('Approved,No,Max Wamsley');
  });
});

describe('a request the approver buys (P-037, P-039, P-040)', () => {
  const max = { name: 'Max Wamsley', email: 'max.wamsley@example.com' };
  const asked = (overrides: Partial<PurchaseLine> = {}) =>
    line({ id: 'a', files: [], paidBy: '', itemLink: 'https://www.example.com/item/42', amountCents: 4500, ...overrides });
  const approverRequest = (overrides: Parameters<typeof request>[0] = {}) => request({ buyer: 'approver', ...overrides });

  it('is sent to the approver whatever it costs, with the employee certifying then, and keeps the rows as sent', () => {
    const lines = [asked(), asked({ id: 'b', rowNumber: 2, vendor: 'Borealis', amountCents: 800 })];
    const prepared = prepareApprovalRequest(approverRequest(), lines, [], now, jane, 1, certified);
    expect(prepared.sentGroups.map((g) => [g.vendor, g.cents, g.bought])).toEqual([
      ['Acme Lab Supply', 4500, false],
      ['Borealis', 800, false]
    ]);
    expect(prepared.sentRows.map((r) => [r.rowNumber, r.vendor, r.amountCents, r.itemLink])).toEqual([
      [1, 'Acme Lab Supply', 4500, 'https://www.example.com/item/42'],
      [2, 'Borealis', 800, 'https://www.example.com/item/42']
    ]);
    expect(prepared.boughtBefore).toBe(false);
    expect(prepared.submission.type).toBe('approval');
    expect(prepared.submission.certificationText).toBe(CERTIFICATION);
    expect(prepared.submission.totalReimburseCents).toBe(0);
    expect(prepared.submission.totalCompanyCents).toBe(5300);
    expect(prepared.submission.emailSummary).toContain('The approver buys this request.');
    expect(prepared.submission.emailSummary).toContain(`Certified by Jane Doe (jane.doe@example.com) when sent, 2026-10-16 09:30:`);
    expect(prepared.submission.emailSummary).not.toContain('https://www.example.com');
  });

  it('refuses to send without the certification, with the wording for sending', () => {
    expect(() => prepareApprovalRequest(approverRequest(), [asked()], [], now, jane, 1)).toThrow(messages.certificationRequiredToSend);
    expect(() => prepareApprovalRequest(approverRequest(), [asked()], [], now, jane, 1, { text: 'I agree.', email: 'jane.doe@example.com' })).toThrow(
      messages.certificationRequiredToSend
    );
    expect(() => prepareApprovalRequest(approverRequest(), [asked()], [], now, jane, 1, { text: CERTIFICATION, email: '' })).toThrow(
      messages.certificationRequiredToSend
    );
  });

  it('refuses to send a request with no web address and no reason, or while it is with the approver', () => {
    expect(() => prepareApprovalRequest(approverRequest(), [asked({ itemLink: '' })], [], now, jane, 1, certified)).toThrow(SubmissionBlockedError);
    expect(() => prepareApprovalRequest(approverRequest({ status: 'Awaiting approval' }), [asked()], [], now, jane, 1, certified)).toThrow(
      messages.alreadyWithApprover
    );
  });

  it('does not ask the employee for the certification of a request the employee buys, at this step (P-028)', () => {
    const lines = [big({ files: [quote()] })];
    const prepared = prepareApprovalRequest(request(), lines, [], now, jane, 1);
    expect(prepared.sentRows).toEqual([]);
    expect(prepared.submission.certificationText).toBe('');
  });

  it('is marked purchased by the approver: the package names the approver as buyer and keeps the employee certification', () => {
    const lines = [asked({ files: [file({ fileName: 'invoice.pdf' })] })];
    const sent = prepareApprovalRequest(approverRequest(), lines, [], now, jane, 1, certified);
    const approved = approverRequest({
      status: 'Approved',
      approvalRounds: 1,
      approval: { sent: sent.sentGroups, approved: groupsForApproved(lines, sent.sentGroups, 'approver'), earlier: [], rows: sent.sentRows },
      approvedBy: 'Max Wamsley',
      approvedByEmail: max.email,
      approvedOn: '2026-10-15 10:00'
    });
    const prepared = prepareSubmission(approved, lines, [], new Date(2026, 9, 17, 14, 0), '', { ...certified, name: 'Jane Doe', on: '2026-10-16 09:30' }, max);
    expect(prepared.submission.type).toBe('package');
    expect(prepared.submission.submitterName).toBe('Max Wamsley');
    expect(prepared.submission.submitterEmail).toBe(max.email);
    expect(prepared.submission.certificationText).toBe(CERTIFICATION);
    expect(prepared.submission.boughtBeforeApproval).toBe(false);
    expect(prepared.submission.emailSubject).toBe('Purchase request bought: Jane Doe, Lab supplies for the Phase 1 assay (PR-0042)');
    expect(prepared.submission.emailSummary).toContain('Bought by the approver: Max Wamsley (max.wamsley@example.com)');
    expect(prepared.submission.emailSummary).toContain('Certified by Jane Doe (jane.doe@example.com) when the request was sent, 2026-10-16 09:30:');
    const row = prepared.csvContent.replace(/^﻿/, '').split('\r\n')[1];
    expect(row).toContain('https://www.example.com/item/42');
    expect(row).toContain('Approver,Company,No');
    expect(row).toContain('Jane Doe (jane.doe@example.com)');
  });

  it('is not submitted by the employee, and is not marked purchased before it is approved', () => {
    const lines = [asked({ files: [file()] })];
    expect(() => prepareSubmission(approverRequest({ status: 'Approved', approval: approval(4500) }), lines, [], now, '', certified)).toThrow(
      messages.approverBuysNotSubmitted
    );
    expect(() => prepareSubmission(approverRequest(), lines, [], now, '', certified, max)).toThrow(ApprovalRequiredError);
  });

  it('lets the approver change the amount past what was approved, with no new approval', () => {
    const lines = [asked({ amountCents: 90000, files: [file()] })];
    const approved = approverRequest({
      status: 'Approved',
      approval: { sent: [], approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 4500, bought: false }], earlier: [] },
      approvedBy: 'Max Wamsley',
      approvedByEmail: max.email
    });
    expect(() => prepareSubmission(approved, lines, [], now, '', certified, max)).not.toThrow();
  });
});
