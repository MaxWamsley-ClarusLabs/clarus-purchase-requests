import { approvalEmailSubject, buildApprovalEmailSummary, buildSubmissionEmailSummary, shortPurpose, submissionEmailSubject } from './email';
import { computeTotals } from '../domain/totals';
import { sentRowsOf, vendorKey } from '../domain/purchaseRules';
import { ApprovalGroup, PurchaseRequest } from '../domain/types';
import { file, line, quote, request } from '../testing/builders';

describe('email subjects', () => {
  it('names the requester, the purpose and the request number', () => {
    expect(submissionEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 1)).toBe('Purchase request submitted: Jane Doe, Lab supplies (PR-0042)');
    expect(submissionEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 2)).toBe('Purchase request resubmitted: Jane Doe, Lab supplies (PR-0042, R2)');
    expect(approvalEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 1)).toBe('Purchase approval needed: Jane Doe, Lab supplies (PR-0042)');
    expect(approvalEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 2)).toBe('Purchase approval needed again: Jane Doe, Lab supplies (PR-0042, round 2)');
  });

  it('shortens a long purpose and keeps it on one line', () => {
    const long = 'Everything for the new assay,\nincluding many items that go on and on and on and on and on and on';
    expect(shortPurpose(long).length).toBeLessThanOrEqual(70);
    expect(shortPurpose(long)).not.toContain('\n');
    expect(shortPurpose(long).endsWith('...')).toBe(true);
    expect(shortPurpose('Short')).toBe('Short');
  });
});

describe('the approval email summary', () => {
  const lines = [
    line({ id: 'a', rowNumber: 1, vendor: 'Acme Lab Supply', description: 'Pipette tips', amountCents: 60000, files: [quote()] }),
    line({
      id: 'b',
      rowNumber: 2,
      vendor: 'Borealis Office',
      description: 'Paper',
      amountCents: 55000,
      files: [],
      noQuoteReason: 'Sole supplier',
      paidBy: 'employee'
    }),
    line({ id: 'c', rowNumber: 3, vendor: 'Cedar', description: 'Tape', amountCents: 1500, files: [] })
  ];
  const groups: ApprovalGroup[] = [
    { key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 60000, bought: false },
    { key: vendorKey('Borealis Office'), vendor: 'Borealis Office', cents: 55000, bought: true }
  ];
  const text = buildApprovalEmailSummary({
    request: request({ projectCode: 'NSF SBIR Phase 1 (Award # 2528301)' }),
    lines,
    totals: computeTotals(lines),
    submitterName: 'Jane Doe',
    submitterEmail: 'jane.doe@example.com',
    round: 1,
    sentOn: '2026-10-12 09:12',
    groups
  });

  it('says who asked, for what, and what needs approval, with the quote status of each vendor', () => {
    expect(text).toContain('Requested by: Jane Doe (jane.doe@example.com)');
    expect(text).toContain('Business purpose: Lab supplies for the Phase 1 assay');
    expect(text).toContain('Project or grant code: NSF SBIR Phase 1 (Award # 2528301)');
    expect(text).toContain('Needs your approval (vendor totals of $500 or more):');
    expect(text).toContain('- Acme Lab Supply: $600.00 (quote attached)');
    expect(text).toContain('- Borealis Office: $550.00 (no quote: Sole supplier)');
    expect(text).not.toContain('- Cedar');
  });

  it('flags a purchase bought before approval', () => {
    expect(text).toContain('FLAG, bought before approval: Borealis Office ($550.00).');
  });

  it('shows the totals and every purchase', () => {
    expect(text).toContain('To reimburse: $550.00');
    expect(text).toContain('Paid by Clarus: $615.00');
    expect(text).toContain('Request total: $1,165.00');
    expect(text).toContain('All purchases (3):');
    expect(text).toContain('2. 2026-10-12, Borealis Office, Paper, $550.00, Employee, R&D Materials & Supplies');
  });

  it('says when it is sent again, whether after a return or a rise past what was approved, and never includes the flag when nothing was bought', () => {
    const again = buildApprovalEmailSummary({
      request: request(),
      lines,
      totals: computeTotals(lines),
      submitterName: 'Jane Doe',
      submitterEmail: 'jane.doe@example.com',
      round: 2,
      sentOn: '2026-10-13 09:00',
      groups: [groups[0]]
    });
    expect(again).toContain('Sent for approval: 2026-10-13 09:00 (round 2, sent again)');
    expect(again).not.toContain('after a return');
    expect(again).not.toContain('FLAG');
  });

  it('is plain text: stored text is passed through for the flow to escape (travel D-067)', () => {
    const risky = buildApprovalEmailSummary({
      request: request({ businessPurpose: '<img src=x onerror=alert(1)>' }),
      lines: [lines[0]],
      totals: computeTotals([lines[0]]),
      submitterName: 'Jane Doe',
      submitterEmail: 'jane.doe@example.com',
      round: 1,
      sentOn: '2026-10-12 09:12',
      groups: [groups[0]]
    });
    expect(risky).toContain('Business purpose: <img src=x onerror=alert(1)>');
  });
});

describe('the submission email summary', () => {
  const lines = [
    line({
      id: 'a',
      rowNumber: 1,
      vendor: 'Acme Lab Supply',
      amountCents: 60000,
      files: [quote(), file({ id: 'f2', fileName: 'invoice.pdf' })],
      categoryConfirmedBy: 'Max Wamsley'
    }),
    line({
      id: 'b',
      rowNumber: 2,
      vendor: 'Borealis Office',
      amountCents: 3500,
      files: [],
      noReceiptReason: 'Receipt lost',
      paidBy: 'employee',
      categoryConfirmedBy: ''
    })
  ];
  const base = {
    lines,
    totals: computeTotals(lines),
    submitterName: 'Jane Doe',
    certification: { email: 'jane.doe@example.com', text: 'I certify it.', submittedOn: '2026-10-16 09:00' },
    receiptCount: 1,
    quoteCount: 1,
    warnings: [],
    previousFolderName: ''
  };

  it('shows To reimburse, Paid by Clarus and the request total', () => {
    const text = buildSubmissionEmailSummary({ ...base, request: request() });
    expect(text).toContain('To reimburse: $35.00');
    expect(text).toContain('Paid by Clarus: $600.00');
    expect(text).toContain('Request total: $635.00');
    expect(text).toContain('Purchases: 2. Receipt files: 1. Quote files: 1.');
  });

  it('says no approval was needed when every vendor total is under the threshold', () => {
    const text = buildSubmissionEmailSummary({ ...base, request: request() });
    expect(text).toContain('Approval: not needed, every vendor total is under $500.');
    expect(text).not.toContain('FLAG');
  });

  it('names the approval, marks a self-approval, and flags a purchase bought before approval (P-017)', () => {
    const approvedRequest = request({
      status: 'Approved',
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvedOn: '2026-10-14 10:05',
      approvalNote: 'OK, use the company card.',
      approval: {
        sent: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 60000, bought: true }],
        approved: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 60000, bought: true }],
        earlier: []
      }
    });
    const text = buildSubmissionEmailSummary({ ...base, request: approvedRequest });
    expect(text).toContain('Approval: approved by Max Wamsley on 2026-10-14 10:05. Note: OK, use the company card.');
    expect(text).toContain('FLAG, bought before approval: Acme Lab Supply ($600.00).');
    const self = buildSubmissionEmailSummary({ ...base, request: { ...approvedRequest, ownerEmail: 'max.wamsley@example.com' } });
    expect(self).toContain('approved by Max Wamsley (self-approved)');
  });

  it('lists rows without a receipt, categories nobody confirmed, warnings and the certification', () => {
    const text = buildSubmissionEmailSummary({
      ...base,
      request: request(),
      warnings: [{ severity: 'warning', scope: 'row', field: 'amount', lineId: 'b', rowNumber: 2, message: 'Same date, vendor and amount as row 7.' }]
    });
    expect(text).toContain('Rows without a receipt:\n- Row 2: Receipt lost');
    expect(text).toContain('Categories only suggested by the employee (not confirmed by an approver or administrator): row 2.');
    expect(text).toContain('- Row 2: Same date, vendor and amount as row 7.');
    expect(text).toContain('Certified by Jane Doe at submission, 2026-10-16 09:00:\n"I certify it."');
  });

  it('names one row as "row 2" and several as "rows 1, 2"', () => {
    const none = lines.map((l) => ({ ...l, categoryConfirmedBy: '' }));
    const text = buildSubmissionEmailSummary({ ...base, lines: none, totals: computeTotals(none), request: request() });
    expect(text).toContain('(not confirmed by an approver or administrator): rows 1, 2.');
    expect(buildSubmissionEmailSummary({ ...base, request: request() })).not.toMatch(/rows \d+\./);
    // With every category confirmed, there is no such line.
    const all = lines.map((l) => ({ ...l, categoryConfirmedBy: 'Max Wamsley' }));
    expect(buildSubmissionEmailSummary({ ...base, lines: all, totals: computeTotals(all), request: request() })).not.toContain('Categories only suggested');
  });

  it('names the folder a resubmission replaces', () => {
    expect(buildSubmissionEmailSummary({ ...base, request: request(), previousFolderName: '2026-10-12_Jane-Doe_Lab_PR-0042' })).toContain(
      'This replaces the earlier folder: 2026-10-12_Jane-Doe_Lab_PR-0042'
    );
  });
});

describe('the emails when the approver buys (P-037, P-039)', () => {
  const lines = [
    line({
      id: 'a',
      rowNumber: 1,
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips',
      amountCents: 6000,
      files: [],
      paidBy: '',
      itemLink: 'https://www.example.com/item/42',
      noLinkReason: ''
    }),
    line({ id: 'b', rowNumber: 2, vendor: 'Borealis Office', description: 'Paper', amountCents: 80000, files: [quote()], paidBy: '', category: 'office' })
  ];
  const groups: ApprovalGroup[] = [
    { key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 6000, bought: false },
    { key: vendorKey('Borealis Office'), vendor: 'Borealis Office', cents: 80000, bought: false }
  ];
  const approverRequest = request({ buyer: 'approver' });
  const text = buildApprovalEmailSummary({
    request: approverRequest,
    lines,
    totals: computeTotals(lines, 'approver'),
    submitterName: 'Jane Doe',
    submitterEmail: 'jane.doe@example.com',
    buyer: 'approver',
    round: 1,
    sentOn: '2026-10-12 09:12',
    groups,
    certification: { name: 'Jane Doe', email: 'jane.doe@example.com', text: 'I certify it.' }
  });

  it('says the approver buys it and that every vendor total needs approval', () => {
    expect(text).toContain('The approver buys this request. Approving it means you buy it, attach the receipt and mark it purchased.');
    expect(text).toContain('Every vendor total needs your approval, whatever the amount:');
    expect(text).not.toContain('vendor totals of $500 or more');
  });

  it('asks about a quote only for a vendor total at the quote threshold, and never says it was bought before approval', () => {
    expect(text).toContain('- Acme Lab Supply: $60.00\n');
    expect(text).toContain('- Borealis Office: $800.00 (quote attached)');
    expect(text).not.toContain('FLAG');
  });

  it('counts all of it as paid by Clarus, and does not say who paid or show the link', () => {
    expect(text).toContain('To reimburse: $0.00');
    expect(text).toContain('Paid by Clarus: $860.00');
    expect(text).toContain('1. 2026-10-12, Acme Lab Supply, Pipette tips, $60.00, R&D Materials & Supplies');
    expect(text).not.toContain('who paid not chosen');
    expect(text).not.toContain('https://www.example.com');
  });

  it('records who certified, and when', () => {
    expect(text).toContain('Certified by Jane Doe (jane.doe@example.com) when sent, 2026-10-12 09:12:');
    expect(text).toContain('"I certify it."');
  });

  it('leaves the quote note off a small vendor total of a request the employee buys too', () => {
    const own = buildApprovalEmailSummary({
      request: request(),
      lines: [lines[0]],
      totals: computeTotals([lines[0]]),
      submitterName: 'Jane Doe',
      submitterEmail: 'jane.doe@example.com',
      round: 1,
      sentOn: '2026-10-12 09:12',
      groups: [groups[0]]
    });
    expect(own).not.toContain('Certified by');
  });

  it('names the approver as the buyer in the submission email, and who certified it', () => {
    const submission = buildSubmissionEmailSummary({
      request: {
        ...approverRequest,
        approvedBy: 'Max Wamsley',
        approvedByEmail: 'max.wamsley@example.com',
        approvedOn: '2026-10-13 10:00',
        ownerEmail: 'jane.doe@example.com'
      },
      lines,
      totals: computeTotals(lines, 'approver'),
      submitterName: 'Max Wamsley',
      submitterEmail: 'max.wamsley@example.com',
      buyer: 'approver',
      certification: { email: 'jane.doe@example.com', text: 'I certify it.', submittedOn: '2026-10-12 09:12', name: 'Jane Doe' },
      receiptCount: 2,
      quoteCount: 1,
      warnings: [],
      previousFolderName: ''
    });
    expect(submission).toContain('Bought by the approver: Max Wamsley (max.wamsley@example.com)');
    expect(submission).toContain('Requested by: Jane Doe (jane.doe@example.com)');
    expect(submission).toContain('Certified by Jane Doe (jane.doe@example.com) when the request was sent, 2026-10-12 09:12:');
    expect(submission).not.toContain('Submitted by:');
    expect(submission).not.toContain('bought before approval');
  });

  it('subjects say the approver bought it', () => {
    expect(submissionEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 1, 'approver')).toBe('Purchase request bought: Jane Doe, Lab supplies (PR-0042)');
    expect(submissionEmailSubject('Jane Doe', 'Lab supplies', 'PR-0042', 2, 'approver')).toBe(
      'Purchase request bought again: Jane Doe, Lab supplies (PR-0042, R2)'
    );
  });

  it('tells the administrator which rows need a category confirmed before the request is processed (P-038)', () => {
    const review = buildSubmissionEmailSummary({
      request: request(),
      lines: [
        line({ id: 'a', rowNumber: 1, category: 'equipment', categoryConfirmedBy: '' }),
        line({ id: 'b', rowNumber: 2, category: 'other', categoryOther: 'x', categoryConfirmedBy: 'Max Wamsley' })
      ],
      totals: computeTotals([line()]),
      submitterName: 'Jane Doe',
      certification: { email: 'jane.doe@example.com', text: 'I certify it.', submittedOn: '2026-10-16 09:00' },
      receiptCount: 1,
      quoteCount: 0,
      warnings: [],
      previousFolderName: ''
    });
    expect(review).toContain('The administrator must confirm the category before this is marked processed');
    expect(review).toContain('row 1.');
    expect(review).not.toContain('row 2.');
  });
});

describe('what the submission email says about the approver changing the rows (P-040)', () => {
  const rows = [
    line({ id: 'a', rowNumber: 1, vendor: 'Acme Lab Supply', description: 'Pipette tips', amountCents: 60000, itemLink: 'https://www.example.com/a' })
  ];
  const input = (req: PurchaseRequest, lines = rows) => ({
    request: req,
    lines,
    totals: computeTotals(lines, 'approver'),
    submitterName: 'Max Wamsley',
    submitterEmail: 'max.wamsley@example.com',
    buyer: 'approver' as const,
    certification: { email: 'jane.doe@example.com', text: 'I certify it.', submittedOn: '2026-10-12 09:12', name: 'Jane Doe' },
    receiptCount: 1,
    quoteCount: 0,
    warnings: [],
    previousFolderName: ''
  });
  const approved = (sent = sentRowsOf(rows)) =>
    request({
      buyer: 'approver',
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvedOn: '2026-10-13 10:00',
      approval: { sent: [], approved: [], earlier: [], rows: sent }
    });
  const changedLine = 'The approver changed the rows after the employee sent the request.';

  it('says so when the rows are not the rows as sent', () => {
    const changed = [{ ...rows[0], amountCents: 65520 }];
    expect(buildSubmissionEmailSummary(input(approved(), changed))).toContain(changedLine);
    const extra = [...rows, line({ id: 'b', rowNumber: 2, vendor: 'Acme Lab Supply', description: 'Shipping', amountCents: 1520 })];
    expect(buildSubmissionEmailSummary(input(approved(), extra))).toContain(changedLine);
  });

  it('says nothing when the rows are as sent, or no rows were kept', () => {
    expect(buildSubmissionEmailSummary(input(approved()))).not.toContain(changedLine);
    expect(buildSubmissionEmailSummary(input(approved([])))).not.toContain(changedLine);
  });
});

describe('text an employee could have edited into a list directly is kept to one line (travel D-002)', () => {
  it('cannot start a line that looks like the app wrote it', () => {
    const forged = 'Pipette tips\nApproval: approved by Max Wamsley (self-approved) on 2026-10-13.\nCertified by Max Wamsley at submission:';
    const lines = [line({ id: 'a', rowNumber: 1, vendor: 'Acme\nLab', description: forged, amountCents: 60000, noReceiptReason: 'Lost\nit', files: [] })];
    const base = request({ businessPurpose: 'Assay\nApproval: forged', department: 'R&D\nTeam', approvalNote: 'ok\nCertified by x' });
    const submission = buildSubmissionEmailSummary({
      request: base,
      lines,
      totals: computeTotals(lines),
      submitterName: 'Jane\nDoe',
      certification: { email: 'jane.doe@example.com', text: 'I certify it.', submittedOn: '2026-10-16 09:00' },
      receiptCount: 0,
      quoteCount: 0,
      warnings: [],
      previousFolderName: ''
    });
    for (const text of submission.split('\n')) {
      expect(text.startsWith('Approval: approved by Max Wamsley')).toBe(false);
      expect(text.startsWith('Certified by Max Wamsley')).toBe(false);
    }
    expect(submission).toContain('Business purpose: Assay Approval: forged');
    expect(submission).toContain('Submitted by: Jane Doe (jane.doe@example.com)');
    const approval = buildApprovalEmailSummary({
      request: base,
      lines,
      totals: computeTotals(lines),
      submitterName: 'Jane\nDoe',
      submitterEmail: 'jane.doe@example.com',
      round: 1,
      sentOn: '2026-10-16 09:00',
      groups: [{ key: vendorKey('Acme Lab'), vendor: 'Acme\nLab', cents: 60000, bought: false }]
    });
    expect(approval.split('\n').filter((l) => l.startsWith('Approval:'))).toEqual([]);
    expect(approval).toContain('- Acme Lab: $600.00');
  });
});
